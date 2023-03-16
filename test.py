import whisper
import pyaudio
from threading import Thread
import torch
import time
import numpy as np
import sounddevice as sd
import traceback
try:

    torch.set_num_threads(1)
    print("LOading model")
    ASR_MODEL = whisper.load_model("base")

    print("Model loaded")
    # print(result["text"])


    CHANNELS = 1
    DEFAULT_INPUT_DEVICE = None  # 4
    DEFAULT_SAMPLE_RATE = 16000
    MAIN_STREAM_BLOCK_SIZE = 8000
    FORMAT = pyaudio.paInt16

    print("VAR PROCESS DECLEARED")


    class AudioStreamVAD(Thread):
        def __init__(self, callback, chunk=MAIN_STREAM_BLOCK_SIZE, device=DEFAULT_INPUT_DEVICE, samplerate=DEFAULT_SAMPLE_RATE):
            super().__init__(daemon=True, group=None)
            self.chunk = chunk
            self.samplerate = samplerate
            self.callback = callback
            self.device = device

        def run(self):
            try:
                print("PROCESS STARTED")
                VAD_MODEL, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                                model='silero_vad',
                                                force_reload=True,
                                                onnx=False)
                print("Silero vad loaded")
                (get_speech_timestamps,
                save_audio,
                read_audio,
                VADIterator,
                collect_chunks) = utils

                print("Stream open")

                # A frame must be either 10, 20, or 30 ms in duration for webrtcvad
                FRAME_DURATION = 30
                CHUNK = self.chunk if self.chunk else int(
                    self.samplerate * FRAME_DURATION / 1000)

                stream = pyaudio.PyAudio().open(input_device_index=self.device,
                                                format=FORMAT,
                                                channels=CHANNELS,
                                                rate=self.samplerate,
                                                input=True,
                                                frames_per_buffer=CHUNK)
                pending_chunks = []
                stop_on_next = False
                print("Inside while loop")
                while True:
                    if self.callback and callable(self.callback):
                        audio_chunk = stream.read(
                            CHUNK, exception_on_overflow=False)
                    if audio_chunk:
                        print("Got audio chunk")
                        timestamps = get_speech_timestamps(np.frombuffer(
                            audio_chunk, dtype='int16').copy(), VAD_MODEL, sampling_rate=self.samplerate)
                        if(len(timestamps) > 0):
                            pending_chunks.append(audio_chunk)
                            stop_on_next = False
                        elif stop_on_next:
                            if(len(pending_chunks) > 1):
                                self.callback(b''.join(pending_chunks))
                            pending_chunks = []
                        else:
                            pending_chunks.append(audio_chunk)
                            stop_on_next = True
            except Exception as e:
                print(e)
                print(traceback.format_exc())


    print("FUNCTION CREATED")


    def on_chunk(data):
        print("Recieved audio data")
        #sd.play(np.frombuffer(data, np.int16))
        audio = np.frombuffer(data, np.int16).flatten().astype(
            np.float32) / 32768.0
        print(ASR_MODEL.transcribe(audio))


    print("STARTING PROCESS")
    AudioStreamVAD(on_chunk).start()
    while True:
        time.sleep(1)
except Exception as ex:
    print(ex)
    print(traceback.format_exc())
