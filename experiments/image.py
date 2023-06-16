from diffusers import (
    StableDiffusionPipeline,
    DPMSolverMultistepScheduler,
    StableDiffusionLatentUpscalePipeline,
    AutoencoderKL,
    LDMSuperResolutionPipeline,
)
import torch
from sys import argv

P_DEVICE = torch.device("cuda")
generator = torch.Generator(device=P_DEVICE).manual_seed(3696906123)
model_id = "HeWhoRemixes/primemix_v21"
print("Loading files")
scheduler = DPMSolverMultistepScheduler.from_pretrained(
    model_id, subfolder="scheduler", safety_checker=None
)
pipeline = StableDiffusionPipeline.from_pretrained(
    model_id,
    custom_pipeline="lpw_stable_diffusion",
    scheduler=scheduler,
    torch_dtype=torch.float16,
    safety_checker=None,
).to(P_DEVICE)

pipeline.load_textual_inversion("EasyNegative.pt")

print("FIles loaded")
# pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
#     pipeline.scheduler.config)

try:
    import xformers

    pipeline.enable_xformers_memory_efficient_attention()
except:
    pass
with torch.inference_mode():
    NEGATIVE_PROMPT = "((EasyNegative)) ,lowres, ((bad anatomy)), ((bad hands)), missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts))"
    # NEGATIVE_PROMPT = "EasyNegative"
    ARGUMENTS = argv[1 : len(argv)]
    PROMPTS = " ".join(ARGUMENTS)
    FINAL_PROMPT = PROMPTS
    low_res_image = pipeline.text2img(
        FINAL_PROMPT,
        negative_prompt=NEGATIVE_PROMPT,
        num_inference_steps=20,
        height=1024,
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
