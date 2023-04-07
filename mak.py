import time
import sys
import asyncio
from random import choice
from transformers import BlenderbotTokenizer, BlenderbotForConditionalGeneration

mname = "facebook/blenderbot-400M-distill"
model = BlenderbotForConditionalGeneration.from_pretrained(mname)
tokenizer = BlenderbotTokenizer.from_pretrained(mname)


def generate(content: str):
    global tokenizer
    global model
    inputs = tokenizer([content], return_tensors="pt")
    reply_ids = model.generate(**inputs)
    return tokenizer.batch_decode(reply_ids)[0].replace("<s>", "").replace("</s>", "").strip()


