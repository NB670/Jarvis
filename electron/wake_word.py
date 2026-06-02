#!/usr/bin/env python3.12
"""
Voice engine for Jarvis. Local-only: mlx-whisper for STT, kokoro for TTS.

Protocol (stdout → Node):
  WAKE           — wake word detected, session starting
  TEXT:<text>    — user utterance transcribed
  AUDIO:<path>   — TTS WAV ready at path (Node plays + deletes)
  SESSION_DONE   — session timed out, back to wake detection

Protocol (stdin ← Node):
  SPEAK:<text>   — synthesize text via Kokoro
  READY          — done speaking, record next utterance
  END            — end session now
"""
import os, sys, struct, time, threading
import tempfile
import numpy as np
import pyaudio
import mlx_whisper
import soundfile as sf
from kokoro import KPipeline

RATE            = 16000
CHUNK           = 512
SPEECH_RMS      = 600
SILENCE_RMS     = 300
SILENCE_FRAMES  = int(2.5 * RATE / CHUNK)
MIN_SPEECH_FRAMES = 4
MAX_SPEECH_S    = 30
SESSION_TIMEOUT_S = 30
WHISPER_MODEL   = os.environ.get('JARVIS_WHISPER_MODEL', 'mlx-community/whisper-base-mlx')
TTS_VOICE       = os.environ.get('JARVIS_TTS_VOICE', 'af_heart')

# ── Audio utils ────────────────────────────────────────────────────────────────

def transcribe(samples):
    """Run mlx-whisper on int16 samples (16kHz). Returns text."""
    try:
        audio = np.array(samples, dtype=np.float32) / 32768.0
        result = mlx_whisper.transcribe(audio, path_or_hf_repo=WHISPER_MODEL)
        return result['text'].strip()
    except Exception as e:
        sys.stderr.write(f'[voice] Whisper error: {e}\n')
        return ''

# ── VAD recording ──────────────────────────────────────────────────────────────

def record_utterance(stream, timeout_s=None):
    """Record one utterance. Returns sample list, or None on timeout/too-short."""
    recording, silence_count, speech_count, in_speech = [], 0, 0, False
    start = time.time()
    while True:
        if timeout_s and not in_speech and time.time() - start > timeout_s:
            return None
        data = stream.read(CHUNK, exception_on_overflow=False)
        frame = list(struct.unpack(f'<{CHUNK}h', data))
        rms = (sum(s*s for s in frame) / len(frame)) ** 0.5
        if rms >= SPEECH_RMS:
            in_speech = True; silence_count = 0; speech_count += 1
            recording.extend(frame)
        elif in_speech:
            recording.extend(frame); silence_count += 1
            if silence_count >= SILENCE_FRAMES:
                break
        if in_speech and len(recording) > MAX_SPEECH_S * RATE:
            break
    return recording if speech_count >= MIN_SPEECH_FRAMES else None

# ── Stdin reader ───────────────────────────────────────────────────────────────

_cmd = None
_cmd_lock = threading.Lock()

def _stdin_reader():
    global _cmd
    for line in sys.stdin:
        with _cmd_lock:
            _cmd = line.strip()

threading.Thread(target=_stdin_reader, daemon=True).start()

def get_cmd():
    global _cmd
    with _cmd_lock:
        c = _cmd; _cmd = None
    return c

def speak(text):
    """Generate TTS for text via Kokoro. Returns WAV file path, or None on error."""
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wav_path = f.name
    try:
        generator = tts_pipeline(text, voice=TTS_VOICE, speed=1.0)
        audio_chunks = []
        for _, _, audio in generator:
            audio_chunks.append(audio)
        if not audio_chunks:
            try: os.unlink(wav_path)
            except: pass
            return None
        full_audio = np.concatenate(audio_chunks) if len(audio_chunks) > 1 else audio_chunks[0]
        sf.write(wav_path, full_audio, 24000)
        return wav_path
    except Exception as e:
        sys.stderr.write(f'[voice] TTS error: {e}\n')
        try: os.unlink(wav_path)
        except: pass
        return None

def wait_for_cmd_or_speak(expected, poll=0.05):
    """Wait for one of `expected`. If SPEAK:<text> arrives, synthesize and continue waiting."""
    while True:
        c = get_cmd()
        if c is None:
            time.sleep(poll); continue
        if c.startswith('SPEAK:'):
            text = c[len('SPEAK:'):]
            wav_path = speak(text)
            if wav_path:
                print(f'AUDIO:{wav_path}', flush=True)
            continue
        if c in expected:
            return c

# ── Main loop ──────────────────────────────────────────────────────────────────

sys.stderr.write(f'[voice] using whisper model {WHISPER_MODEL}\n'); sys.stderr.flush()
sys.stderr.write('[voice] loading kokoro tts...\n'); sys.stderr.flush()
tts_pipeline = KPipeline(lang_code='a')
sys.stderr.write('[voice] kokoro ready\n'); sys.stderr.flush()

p = pyaudio.PyAudio()
stream = p.open(format=pyaudio.paInt16, channels=1, rate=RATE, input=True,
                frames_per_buffer=CHUNK)

try:
    while True:
        # ── Wake detection ────────────────────────────────────────────────────
        sys.stderr.write("[wake] listening for 'Hey Jarvis'...\n"); sys.stderr.flush()
        recording, silence_count, speech_count, in_speech = [], 0, 0, False
        while True:
            data = stream.read(CHUNK, exception_on_overflow=False)
            frame = list(struct.unpack(f'<{CHUNK}h', data))
            rms = (sum(s*s for s in frame) / len(frame)) ** 0.5
            if rms >= SPEECH_RMS:
                in_speech = True; silence_count = 0; speech_count += 1
                recording.extend(frame)
            elif in_speech:
                recording.extend(frame); silence_count += 1
                if silence_count >= SILENCE_FRAMES:
                    if speech_count >= MIN_SPEECH_FRAMES:
                        text = transcribe(recording).lower()
                        sys.stderr.write(f'[wake] heard: "{text}"\n'); sys.stderr.flush()
                        if 'jarvis' in text:
                            break
                    recording, silence_count, speech_count, in_speech = [], 0, 0, False
            if in_speech and len(recording) > MAX_SPEECH_S * RATE:
                recording, silence_count, speech_count, in_speech = [], 0, 0, False

        print('WAKE', flush=True)

        # ── Session recording ─────────────────────────────────────────────────
        sys.stderr.write('[voice] session started\n'); sys.stderr.flush()
        while True:
            cmd = get_cmd()
            if cmd == 'END':
                break

            samples = record_utterance(stream, timeout_s=SESSION_TIMEOUT_S)
            if samples is None:
                print('SESSION_DONE', flush=True)
                break

            text = transcribe(samples)
            sys.stderr.write(f'[voice] you: "{text}"\n'); sys.stderr.flush()
            if not text:
                print('SESSION_DONE', flush=True)
                break

            print(f'TEXT:{text}', flush=True)
            cmd = wait_for_cmd_or_speak({'READY', 'END'})
            if cmd == 'END':
                break

        sys.stderr.write('[voice] session ended\n'); sys.stderr.flush()

except KeyboardInterrupt:
    pass
finally:
    stream.stop_stream(); stream.close(); p.terminate()
