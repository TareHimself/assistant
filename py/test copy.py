from soc import ProcessSocket
import time
import sys
import asyncio
from random import choice
import tornado.web
from transformers import BlenderbotTokenizer, BlenderbotForConditionalGeneration
tokenizer = BlenderbotTokenizer.from_pretrained(
    "facebook/blenderbot-400M-distill")
model = BlenderbotForConditionalGeneration.from_pretrained(
    "facebook/blenderbot-400M-distill")



def generate(content: str):
    global tokenizer
    global model
    inputs = tokenizer(content, return_tensors="pt")
    res = model.generate(**inputs)
    return tokenizer.decode(res[0]).replace("<s>", "").replace("</s>", "").strip()


testSocket = ProcessSocket()


def on_packet(packet_id: str, packet: bytes, address: tuple[str, int]):
    testSocket.send(packet_id, generate(packet.decode()).encode(), address)


testSocket.add_on_packet(on_packet)

testSocket.ready()
while True:
    time.sleep(10)
