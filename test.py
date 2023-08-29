import ctypes
import sys
from gpt4all import pyllmodel
from typing import Callable
from gpt4all.pyllmodel import PromptCallback,ResponseCallback,RecalculateCallback,LLModelPromptContext, llmodel
import time


llm = pyllmodel.LLModel()
llm.load_model("./ggml-wizard-13b-uncensored.bin")

chat_log = """Instruction: You are a virtual assistant named Alice. You must respond in a reasonable manner\n
USER: How are you?
ALICE: """


def get_llm_response(model:pyllmodel.LLModel, prompt: str,stop_token:str = "USER:",polling_interval=0.2):
    total_decoded = ""
    decoding = True
    def on_response_callback(token_id: str,response: bytes):
        nonlocal total_decoded
        nonlocal stop_token
        nonlocal decoding

        decoded_token = response.decode('utf-8')
        total_decoded += decoded_token

        if stop_token in total_decoded:
            total_decoded = total_decoded[:total_decoded.index(stop_token)].strip()
            decoding = False
            return False
        
        return True

    model._response_callback = on_response_callback

    std_out = sys.stdout
    # print("Starting")
    model.prompt_model(
            chat_log,
            temp=0.8,
            top_p=0.95,
            top_k=40,
            repeat_penalty=1.1,
            repeat_last_n=64,
            n_batch=512,
            n_ctx=512,
            n_predict=1024,
            streaming=True,
        )
    # print("Done")
    
    sys.stdout = std_out

    return total_decoded.strip()


print("FINAL RESPONSE",get_llm_response(llm,chat_log))
