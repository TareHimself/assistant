from diffusers import (
    StableDiffusionPipeline,
    DPMSolverMultistepScheduler,
    StableDiffusionLatentUpscalePipeline,
    AutoencoderKL,
    LDMSuperResolutionPipeline,
)
import torch
import io
from sys import argv

generator = torch.manual_seed(2203084815)
model_id = "anything-v4.0"
scheduler = DPMSolverMultistepScheduler.from_pretrained(model_id, subfolder="scheduler")
pipeline = StableDiffusionPipeline.from_pretrained(
    model_id, scheduler=scheduler, torch_dtype=torch.float16
)
# pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
#     pipeline.scheduler.config)
pipeline.to("cuda")


NEGATIVE_PROMPT = "lowres, ((bad anatomy)), ((bad hands)), text, missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, logo, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts))"
ARGUMENTS = argv[1 : len(argv)]
PROMPTS = " ".join(ARGUMENTS)
FINAL_PROMPT = PROMPTS
low_res_image = pipeline(
    FINAL_PROMPT,
    negative_prompt=NEGATIVE_PROMPT,
    num_inference_steps=20,
    height=512,
    width=512,
    guidance_scale=7,
    generator=generator,
).images
low_res_image[0].save("test-2.png")
# upscaled_image = upscaler(
#     image=low_res_image[0],
#     num_inference_steps=20,
#     generator=generator
# ).images[0]

# output = io.BytesIO()
# upscaled_image.save(output, format='PNG')

# with open('data.png', 'wb') as d:
#     d.write(output.getvalue())
