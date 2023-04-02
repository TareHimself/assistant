

from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler, AutoencoderKL
import torch
import io
from sys import argv
import time
import torch
import sounddevice as sd
from os import path
from bridge import Bridge, debug


main_process = Bridge()


model_pastel = "TareHimself/pastelmix-better-vae"
scheduler = DPMSolverMultistepScheduler.from_pretrained(
    model_pastel, subfolder="scheduler")
pipeline_pastel = StableDiffusionPipeline.from_pretrained(
    model_pastel, scheduler=scheduler, torch_dtype=torch.float16)

model_anything = "TareHimself/anything-v4.0"
scheduler = DPMSolverMultistepScheduler.from_pretrained(
    model_anything, subfolder="scheduler")
pipeline_anything = StableDiffusionPipeline.from_pretrained(
    model_anything, scheduler=scheduler,  torch_dtype=torch.float16)

pipeline_pastel = pipeline_pastel.to("cuda")
pipeline_anything = pipeline_anything.to("cuda")
NEGATIVE_PROMPT = "lowres, ((bad anatomy)), ((bad hands)), text, missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, logo, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts)), EasyNegative"


def on_packet(op, packet: bytes):
    global pipeline_pastel
    global main_process

    pipeline_to_use = pipeline_pastel if op == 1 else pipeline_anything

    prompt = packet.decode('utf-8')
    debug(b'Generating')
    image = pipeline_to_use(prompt,
                            negative_prompt=NEGATIVE_PROMPT, num_inference_steps=60, height=8 * 64, width=8 * 64, guidance_scale=7).images[0]
    debug(b'Done Generating')
    output = io.BytesIO()
    image.save(output, format='PNG')

    bytesToSend = output.getvalue()

    main_process.send(bytesToSend, op)


main_process.add_on_packet(on_packet)

main_process.ready()

while True:
    time.sleep(10)
