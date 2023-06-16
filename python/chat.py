from bridge import Bridge
import time
from random import choice
import json
from gpt4all import GPT4All
from threading import get_ident

model = GPT4All("ggml-wizard-13b-uncensored")


process_bridge = Bridge()


def on_packet(op: int, packet: bytes):
    global model
    print(packet.decode(), file=open("latest_prompt.txt", "w"))
    response = model.model.prompt_model(
        "You are a virtual assistant named Alice. Generate one response for ASSISTANT\n"
        + packet.decode(),
        temp=0.8,
        top_p=0.95,
        top_k=40,
        repeat_penalty=1.1,
        repeat_last_n=64,
        n_batch=9,
        n_ctx=512,
        n_predict=1024,
        streaming=False,
    )

    process_bridge.send(response.encode(), op)


process_bridge.add_on_packet(on_packet)

process_bridge.ready()
