#!/usr/bin/env python3
"""OpenWakeWord listener — prints WAKE to stdout when 'Hey Jarvis' is detected."""
import sys
import pyaudio
import numpy as np

try:
    from openwakeword.model import Model
except ImportError:
    sys.stderr.write('[wake] openwakeword not installed: pip install openwakeword\n')
    sys.exit(1)

CHUNK = 1280   # 80ms at 16kHz (required by openwakeword)
RATE = 16000
CHANNELS = 1
FORMAT = pyaudio.paInt16
THRESHOLD = 0.5

model = Model(wakeword_models=['hey_jarvis_v0.1'], inference_framework='onnx')

p = pyaudio.PyAudio()
stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True,
                frames_per_buffer=CHUNK)

sys.stderr.write("[wake] listening for 'Hey Jarvis'...\n")
sys.stderr.flush()

try:
    while True:
        data = stream.read(CHUNK, exception_on_overflow=False)
        audio = np.frombuffer(data, dtype=np.int16)
        prediction = model.predict(audio)
        for score in prediction.values():
            if score >= THRESHOLD:
                print('WAKE', flush=True)
                model.reset()
                break
except KeyboardInterrupt:
    pass
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()
