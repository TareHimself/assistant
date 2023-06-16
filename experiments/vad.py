
from collections.abc import Callable, Iterable, Mapping
from threading import Thread
import time
from typing import Any
import pyaudio
import numpy as np
from collections import deque
from queue import Queue
from transformers import pipeline
from datasets import load_dataset
import torch
from speech_recognition import AudioData


class AudioStream(Thread):

    CHANNELS = 1
    DEFAULT_INPUT_DEVICE = None  # 4
    DEFAULT_SAMPLE_RATE = 16000
    MAIN_STREAM_BLOCK_SIZE = 8000
    FORMAT = pyaudio.paInt16

    def __init__(self, callback, chunk=MAIN_STREAM_BLOCK_SIZE, device=DEFAULT_INPUT_DEVICE, samplerate=DEFAULT_SAMPLE_RATE):
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
            CHUNK = self.chunk if self.chunk else int(
                self.samplerate * FRAME_DURATION / 1000)

            stream = audio.open(input_device_index=self.device,
                                format=AudioStream.FORMAT,
                                channels=AudioStream.CHANNELS,
                                rate=self.samplerate,
                                input=True,
                                frames_per_buffer=CHUNK)

            while True:
                if self.callback and callable(self.callback):
                    audio_chunk = stream.read(
                        CHUNK, exception_on_overflow=False)
                    if audio_chunk:
                        self.callback(audio_chunk)

                # self.ProcessJobs()


class SileroVad(Thread):

    def __init__(self, callback) -> None:
        super().__init__(group=None, daemon=True)
        self.callback = callback
        self.audio_queue = Queue()

    def run(self):
        print("Process started")
        AudioStream(lambda a: self.audio_queue.put(a)).start()
        print("Downloading vad model")
        model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                      model='silero_vad', trust_repo=True)
        print("Getting utils")
        (get_speech_timestamps,
            _, read_audio,
            *_) = utils
        print("Model ready, waiting for speech")
        temp = deque(maxlen=3)
        audio_chunk = self.audio_queue.get()
        pending_buffer = b''
        while audio_chunk is not None:

            temp.append(audio_chunk)
            temp_combined = b''.join(list(temp))
            speech_timestamps = get_speech_timestamps(
                np.frombuffer(temp_combined, dtype=np.int16).copy(), model, sampling_rate=AudioStream.DEFAULT_SAMPLE_RATE)
            if len(speech_timestamps) > 0:
                if len(pending_buffer) == 0:
                    pending_buffer = temp_combined
                else:
                    pending_buffer += audio_chunk
            else:
                if len(pending_buffer) > 0:
                    timestamps = get_speech_timestamps(
                        np.frombuffer(pending_buffer, dtype=np.int16).copy(), model, sampling_rate=AudioStream.DEFAULT_SAMPLE_RATE)
                    start_timestamp = min(timestamps, key=lambda a: a['start'])
                    self.callback(
                        pending_buffer[start_timestamp['start']:len(pending_buffer)])
                    pending_buffer = b''
                    temp.clear()
            audio_chunk = self.audio_queue.get()


model_id = "openai/whisper-base.en"
device = "cuda:0" if torch.cuda.is_available() else "cpu"

pipe = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-base",
    chunk_length_s=30,
    device=device,
)


def transcribe(chunk):
    chun = AudioData(chunk, 16000, 4)
    #np.frombuffer( chunk, dtype=np.float32).copy()
    transcription = pipe(np.frombuffer(chun.get_wav_data(), dtype=np.int16))
    print(transcription)


SileroVad(transcribe).start()
while True:
    time.sleep(2)
