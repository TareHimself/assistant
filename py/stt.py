import json
import time
from vosk import Model, KaldiRecognizer, SetLogLevel
from bridge import Bridge, AudioStream, debug_string
import os
from os import getcwd, path
import sounddevice as sd

SetLogLevel(-1)

SAMPLE_RATE = 16000
AUDIO_DEVICE = None

testSocket = Bridge()
recognizer = None

VOSK_MODEL_DIR = ""


def on_voice_chunk(d):
    if recognizer.AcceptWaveform(bytes(d)):
        result = json.loads(recognizer.Result())['text'] + ""
        if len(result) > 0:
            testSocket.send(result.encode('utf-8'))


model = Model(model_path=path.join(
    os.path.dirname(os.path.realpath(__file__)), 'stt'))
recognizer = KaldiRecognizer(model, SAMPLE_RATE)
audio = AudioStream(callback=on_voice_chunk, chunk=8000,
                    samplerate=SAMPLE_RATE, device=AUDIO_DEVICE)
audio.start()

testSocket.ready()
while True:
    time.sleep(10)
