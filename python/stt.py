import json
import time
from vosk import Model, KaldiRecognizer, SetLogLevel
from bridge import Bridge, AudioStream
import os
from os import getcwd, path
import sounddevice as sd
import sys
SetLogLevel(-1)

SAMPLE_RATE = 16000
AUDIO_DEVICE = None

testSocket = Bridge()
recognizer = None

_, MODEL_PATH = sys.argv
MODEL_PATH = path.join(MODEL_PATH, 'stt')


def on_voice_chunk(d):
    if recognizer.AcceptWaveform(bytes(d)):
        result = json.loads(recognizer.Result())['text'] + ""
        if len(result) > 0:
            testSocket.send(result.encode('utf-8'))


model = Model(model_path=MODEL_PATH)
recognizer = KaldiRecognizer(model, SAMPLE_RATE)
audio = AudioStream(callback=on_voice_chunk, chunk=8000,
                    samplerate=SAMPLE_RATE, device=AUDIO_DEVICE)
audio.start()

testSocket.ready()
while True:
    time.sleep(10)
