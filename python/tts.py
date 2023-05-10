import time
import torch
import sounddevice as sd
from os import path
from bridge import Bridge
import sys

torch._C._jit_set_profiling_mode(False)

device = torch.device("cpu")
torch.set_num_threads(8)

SAMPLE_RATE = 48000
TTS_SPEAKER = "en_10"
TTS_URL = "https://models.silero.ai/models/tts/en/v3_en.pt"

CHANNELS = 1
# VB Cable B INPUT 16  #
OUTPUT_DEVICE = None  # 16  # 4
_, MODEL_PATH = sys.argv
MODEL_PATH = path.join(MODEL_PATH, "tts.pt")

if not path.exists(MODEL_PATH):
    torch.hub.download_url_to_file(TTS_URL, MODEL_PATH)


model = torch.package.PackageImporter(MODEL_PATH).load_pickle("tts_models", "model")

model.to(device)

testSocket = Bridge()


def on_packet(op, packet: bytes):
    global OUTPUT_DEVICE
    to_say = packet.decode() + "."
    audio = model.apply_tts(
        text=to_say,
        speaker=TTS_SPEAKER,
        sample_rate=SAMPLE_RATE,
    )

    sd.play(audio, SAMPLE_RATE, blocking=True, device=OUTPUT_DEVICE)

    testSocket.send("done".encode(), op)


testSocket.add_on_packet(on_packet)

testSocket.ready()

while True:
    time.sleep(10)
