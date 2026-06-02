#!/usr/bin/env python3.12
"""Smoke test: load mlx-whisper and kokoro, transcribe + synthesize."""
import time
import mlx_whisper
import soundfile as sf
from kokoro import KPipeline

print('Loading kokoro...')
t0 = time.time()
pipeline = KPipeline(lang_code='a')  # American English
print(f'  ready in {time.time()-t0:.1f}s')

print('Generating TTS sample ("hello world")...')
t0 = time.time()
generator = pipeline('hello world', voice='af_heart', speed=1.0)
audio_chunks = []
for _, _, audio in generator:
    audio_chunks.append(audio)
import numpy as np
full_audio = np.concatenate(audio_chunks) if len(audio_chunks) > 1 else audio_chunks[0]
sf.write('/tmp/jarvis-smoke.wav', full_audio, 24000)
print(f'  generated in {time.time()-t0:.1f}s, wrote /tmp/jarvis-smoke.wav')

print('Transcribing /tmp/jarvis-smoke.wav...')
t0 = time.time()
# Load audio as numpy array to avoid ffmpeg dependency
audio_data, sample_rate = sf.read('/tmp/jarvis-smoke.wav', dtype='float32')
# mlx-whisper expects mono float32 at 16kHz
if audio_data.ndim > 1:
    audio_data = audio_data.mean(axis=1)
# Resample to 16kHz if needed
if sample_rate != 16000:
    import scipy.signal
    num_samples = int(len(audio_data) * 16000 / sample_rate)
    audio_data = scipy.signal.resample(audio_data, num_samples)
result = mlx_whisper.transcribe(audio_data, path_or_hf_repo='mlx-community/whisper-base-mlx')
print(f'  transcribed in {time.time()-t0:.1f}s → "{result["text"].strip()}"')
print('OK')
