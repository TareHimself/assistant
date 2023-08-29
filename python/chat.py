from bridge import Bridge, debug_string
import sys
from gpt4all import GPT4All


process_bridge = Bridge()

model = GPT4All("wizardLM-13B-Uncensored.ggmlv3.q4_0.bin")
# model = GPT4All("ggml-wizard-13b-uncensored.bin",model_path="./")

def on_packet(op: int, packet: bytes):
    llm_input = packet.decode()
    # output = llm(
    #     llm_input,
    #     max_tokens=256,
    #     stop=["USER:"],
    #     temperature=0.8,
    #     top_p=0.95,
    #     top_k=40,
    #     repeat_penalty=1.1,
    #     echo=True,
    # )

    total = ""

    def should_decode_next(token_id: int, data: str):
        nonlocal total
        return "USER:" not in total
        
    
    for token in model.generate(llm_input, callback=should_decode_next, streaming=True):
        total += token

    process_bridge.send(total.replace("USER:","").strip().encode(), op)


process_bridge.add_on_packet(on_packet)

process_bridge.ready()
