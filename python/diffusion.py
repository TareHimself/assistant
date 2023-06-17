import json
import re
from diffusers import (
    StableDiffusionPipeline,
    DPMSolverMultistepScheduler,
)
import random
import torch
import io
import torch
import sounddevice as sd
import os
from bridge import Bridge, debug
from neural.utils import PYTORCH_DEVICE

PROMPT_PARAM_EXTRACTOR = r"<([a-z\s]+):([a-z0-9_\s]+):(.+?)>"

main_process = Bridge()

cur_model_id = None
pipeline = None


def get_generation_config(prompt: str):
    global PROMPT_PARAM_EXTRACTOR
    clean_prompt = ",".join(
        filter(
            lambda a: len(a.strip()) > 0,
            re.sub(PROMPT_PARAM_EXTRACTOR, "", prompt).split(","),
        )
    )
    config = {}
    for param_cat, param_id, param_value in re.findall(PROMPT_PARAM_EXTRACTOR, prompt):
        if param_cat not in config.keys():
            config[param_cat.lower()] = {}

        config[param_cat.lower()][param_id.lower()] = param_value

    return clean_prompt, config


def load_model(model_id: str):
    global pipeline
    global cur_model_id
    if pipeline is not None and cur_model_id != model_id:
        del pipeline
        pipeline = None

    if cur_model_id == model_id:
        return pipeline

    pipeline = StableDiffusionPipeline.from_pretrained(
        model_id,
        scheduler=DPMSolverMultistepScheduler.from_pretrained(
            model_id, subfolder="scheduler"
        ),
        custom_pipeline="lpw_stable_diffusion",
        torch_dtype=torch.float16,
        safety_checker=None,
    ).to(PYTORCH_DEVICE)
    pipeline.load_textual_inversion(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "EasyNegative.pt")
    )
    try:
        import xformers

        pipeline.enable_xformers_memory_efficient_attention()
    except:
        pass

    cur_model_id = model_id
    return pipeline


# NEGATIVE_PROMPT = "lowres, ((bad anatomy)), ((bad hands)), text, missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, logo, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts)), EasyNegative"
NEGATIVE_PROMPT = "((EasyNegative)) , lowres , ((bad anatomy)), ((bad hands)), missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts))"


def on_packet(op, packet: bytes):
    global main_process

    data = json.loads(packet.decode())
    model_id, prompt = data["model_id"], data["prompt"]

    prompt, config = get_generation_config(prompt)

    pipe = load_model(model_id)

    main_params = config.get("params", {})
    width, height = main_params.get("size", f"{512}x{512}").split("x")
    width, height = (
        min(round(int(width) / 8) * 8, 1024) if width.isdigit() else 512,
        min(round(int(height) / 8) * 8, 1024) if height.isdigit() else 512,
    )

    steps = main_params.get("steps", "32")
    steps = min(int(steps) if steps.isdigit() else 32, 50)

    guidance = main_params.get("control", "7")
    guidance = min(int(guidance) if guidance.isdigit() else 7, 15)

    seed = main_params.get("seed", f"{random.randint(1000000000, 9999999999)}")
    seed = int(seed) if seed.isdigit() else random.randint(1000000000, 9999999999)
    seed = torch.Generator(device=PYTORCH_DEVICE).manual_seed(seed)

    debug(json.dumps(main_params).encode())
    with torch.inference_mode():
        debug(b"Generating")
        image = pipe.text2img(
            prompt,
            negative_prompt=NEGATIVE_PROMPT,
            num_inference_steps=steps,
            height=height,
            width=width,
            guidance_scale=guidance,
            generator=seed,
            max_embeddings_multiples=4,
        ).images[0]
        debug(b"Done Generating")
        output = io.BytesIO()
        image.save(output, format="PNG")
        main_process.send(output.getvalue(), op)


main_process.add_on_packet(on_packet)

main_process.ready()
