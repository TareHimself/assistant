from transformers import pipeline, StoppingCriteria

generator = pipeline('text-generation', model='PygmalionAI/pygmalion-350m')

persona = """Alice's Persona: An assistant built with NodeJS.
<START>
"""

prompt = persona + """You: Hi, who are you?
Alice:"""

generated = generator(prompt,
                      max_length=len(prompt) + 30, num_return_sequences=1)[0]['generated_text']

print(generated[len(prompt):len(generated)].split('\n')[0].strip())
