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
model_id = "pastelmix-better-vae-fp16"
print("Loading files")
scheduler = DPMSolverMultistepScheduler.from_pretrained(
    model_id, subfolder="scheduler", safety_checker=None
)
pipeline = StableDiffusionPipeline.from_pretrained(
    model_id,
    scheduler=scheduler,
    torch_dtype=torch.float16,
    safety_checker=None,
    custom_pipeline="lpw_stable_diffusion",
).to(P_DEVICE)
print("FIles loaded")
# pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
#     pipeline.scheduler.config)

try:
    import xformers

    pipeline.enable_xformers_memory_efficient_attention()
except:
    pass
with torch.inference_mode():
    NEGATIVE_PROMPT = "(worst quality, low quality:2), NSFW,monochrome, zombie,overexposure, watermark,text,bad anatomy,bad hand,((extra hands)),extra fingers,too many fingers,fused fingers,bad arm,distorted arm,extra arms,fused arms,extra legs,missing leg,disembodied leg,extra nipples, detached arm, liquid hand,inverted hand,disembodied limb, oversized head,extra body,extra navel,easynegative,(hair between eyes),sketch, duplicate, ugly, huge eyes, text, logo, worst face, (bad and mutated hands:1.3), (blurry:2.0), horror, geometry, bad_prompt, (bad hands), (missing fingers), multiple limbs, bad anatomy, (interlocked fingers:1.2), Ugly Fingers, (extra digit and hands and fingers and legs and arms:1.4), (deformed fingers:1.2), (long fingers:1.2),(bad-artist-anime), bad-artist, bad hand, extra legs ,(ng_deepnegative_v1_75t),((hands on head))"  # "lowres, ((bad anatomy)), ((bad hands)), text, missing finger, extra digits, fewer digits, blurry, ((mutated hands and fingers)), (poorly drawn face), ((mutation)), ((deformed face)), (ugly), ((bad proportions)), ((extra limbs)), extra face, (double head), (extra head), ((extra feet)), monster, logo, cropped, worst quality, low quality, normal quality, jpeg, humpbacked, long body, long neck, ((jpeg artifacts))"
    ARGUMENTS = argv[1 : len(argv)]
    PROMPTS = " ".join(ARGUMENTS)
    FINAL_PROMPT = PROMPTS
    low_res_image = pipeline(
        FINAL_PROMPT,
        negative_prompt=NEGATIVE_PROMPT,
        num_inference_steps=50,
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
