#!/usr/bin/env python3
"""
Wake word detector: records speech via VAD, checks for "jarvis" via Whisper API.
Prints WAKE to stdout when triggered. Reads OPENAI_API_KEY from environment.
"""
import os, sys, io, struct, wave, time
import pyaudio, urllib.request, json

RATE = 16000
CHUNK = 512            # ~32ms frames
SPEECH_THRESHOLD = 600  # RMS above this = speech
SILENCE_THRESHOLD = 300 # RMS below this = silence
SILENCE_SECONDS = 0.6   # seconds of silence to end utterance
SILENCE_FRAMES = int(SILENCE_SECONDS * RATE / CHUNK)
MIN_SPEECH_FRAMES = 4   # ignore very short bursts (<128ms)
MAX_SPEECH_SECONDS = 4  # cap utterance length

API_KEY = os.environ.get('OPENAI_API_KEY', '')
if not API_KEY:
    sys.stderr.write('[wake] OPENAI_API_KEY not set\n')
    sys.exit(1)

def build_wav(samples):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(struct.pack(f'<{len(samples)}h', *samples))
    return buf.getvalue()

def whisper_transcribe(wav_bytes):
    boundary = b'----WakeBoundary'
    body = (
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n'
        b'--' + boundary + b'\r\n'
        b'Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'
        b'Content-Type: audio/wav\r\n\r\n' + wav_bytes + b'\r\n'
        b'--' + boundary + b'--\r\n'
    )
    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/transcriptions',
        data=body,
        headers={
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': f'multipart/form-data; boundary={boundary.decode()}',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())['text'].lower()
    except Exception as e:
        sys.stderr.write(f'[wake] Whisper error: {e}\n')
        return ''

p = pyaudio.PyAudio()
stream = p.open(format=pyaudio.paInt16, channels=1, rate=RATE, input=True,
                frames_per_buffer=CHUNK)

sys.stderr.write("[wake] listening for 'Hey Jarvis'...\n")
sys.stderr.flush()

recording = []
silence_count = 0
speech_count = 0
in_speech = False

try:
    while True:
        data = stream.read(CHUNK, exception_on_overflow=False)
        frame = list(struct.unpack(f'<{CHUNK}h', data))
        rms = (sum(s * s for s in frame) / len(frame)) ** 0.5

        if rms >= SPEECH_THRESHOLD:
            in_speech = True
            silence_count = 0
            speech_count += 1
            recording.extend(frame)
        elif in_speech:
            recording.extend(frame)
            silence_count += 1
            if silence_count >= SILENCE_FRAMES:
                # End of utterance
                if speech_count >= MIN_SPEECH_FRAMES:
                    wav = build_wav(recording)
                    text = whisper_transcribe(wav)
                    sys.stderr.write(f'[wake] heard: "{text}"\n')
                    sys.stderr.flush()
                    if 'jarvis' in text:
                        print('WAKE', flush=True)
                recording = []
                silence_count = 0
                speech_count = 0
                in_speech = False

        # Cap max recording length
        if in_speech and len(recording) > MAX_SPEECH_SECONDS * RATE:
            recording = []
            silence_count = 0
            speech_count = 0
            in_speech = False

except KeyboardInterrupt:
    pass
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()
