from bridge import Bridge
import time
import sys
import asyncio
from random import choice
from transformers import pipeline
from neural.utils import PYTORCH_DEVICE

# generator = pipeline(
#     "text-generation",
#     model="PygmalionAI/pygmalion-1.3b",
#     device=PYTORCH_DEVICE,  # "cpu"
# )

# persona = """Alice's Persona: An assistant built with NodeJS.
# <START>
# """


# def generate(content: str) -> str:
#     global persona

#     prompt = persona + content + "\nAlice:"
#     #
#     generated = generator(prompt, max_length=len(prompt) + 15, num_return_sequences=1)[
#         0
#     ]["generated_text"]
#     return generated[len(prompt) : len(generated)].split("\n")[0].strip()


process_bridge = Bridge()


# def on_packet(op: int, packet: bytes):
#     global process_bridge
#     response = generate(packet.decode())
#     process_bridge.send(response.encode(), op)


# process_bridge.add_on_packet(on_packet)

process_bridge.ready()
while True:
    time.sleep(10)
