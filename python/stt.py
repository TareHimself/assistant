import json
from threading import Thread
import time
import pyaudio
from vosk import Model, KaldiRecognizer, SetLogLevel
from bridge import Bridge
from os import path
import sounddevice as sd
import sys

SetLogLevel(-1)


class AudioStream(Thread):
    CHANNELS = 1
    DEFAULT_INPUT_DEVICE = None  # 4
    DEFAULT_SAMPLE_RATE = 16000
    MAIN_STREAM_BLOCK_SIZE = 8000
    FORMAT = pyaudio.paInt16

    def __init__(
        self,
        callback,
        chunk=None,
        device=DEFAULT_INPUT_DEVICE,
        samplerate=DEFAULT_SAMPLE_RATE,
    ):
        super().__init__(daemon=True, group=None)
        self.chunk = chunk
        self.samplerate = samplerate
        self.callback = callback
        self.device = device

    def run(self):
        while True:
            audio = pyaudio.PyAudio()

            # A frame must be either 10, 20, or 30 ms in duration for webrtcvad
            FRAME_DURATION = 30
            CHUNK = (
                self.chunk
                if self.chunk
                else int(self.samplerate * FRAME_DURATION / 1000)
            )

            stream = audio.open(
                input_device_index=self.device,
                format=AudioStream.FORMAT,
                channels=AudioStream.CHANNELS,
                rate=self.samplerate,
                input=True,
                frames_per_buffer=CHUNK,
            )

            while True:
                if self.callback and callable(self.callback):
                    audio_chunk = stream.read(CHUNK, exception_on_overflow=False)
                    if audio_chunk:
                        self.callback(audio_chunk)


SAMPLE_RATE = 16000
AUDIO_DEVICE = None

testSocket = Bridge()
recognizer = None

_, MODEL_PATH = sys.argv
MODEL_PATH = path.join(MODEL_PATH, "stt")


def on_voice_chunk(d):
    if recognizer.AcceptWaveform(bytes(d)):
        result = json.loads(recognizer.Result())["text"] + ""
        if len(result) > 0:
            testSocket.send(result.encode("utf-8"))


model = Model(model_path=MODEL_PATH)
recognizer = KaldiRecognizer(model, SAMPLE_RATE)
audio = AudioStream(
    callback=on_voice_chunk, chunk=8000, samplerate=SAMPLE_RATE, device=AUDIO_DEVICE
)
audio.start()

testSocket.ready()
