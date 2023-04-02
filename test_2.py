from transformers import AutoTokenizer, AutoConfig, AutoModelForCausalLM
import torch.nn as nn
import torch
import os
import transformers
from datasets import load_dataset
# os.environ["CUDA_VISIBLE_DEVICES"] = "0"

model = AutoModelForCausalLM.from_pretrained(
    "facebook/opt-125m",
    device_map='auto',
)

tokenizer = AutoTokenizer.from_pretrained('facebook/opt-125m')

data = load_dataset("Abirate/english_quotes")
print(data)
data = data.map(lambda samples: tokenizer(samples['quote']), batched=True)

trainer = transformers.Trainer(
    model=model,
    train_dataset=data['train'],
    args=transformers.TrainingArguments(
        per_device_train_batch_size=4,
        gradient_accumulation_steps=40,
        warmup_steps=100,
        max_steps=200,
        learning_rate=2e-4,
        fp16=True,
        logging_steps=1,
        output_dir='outputs'
    ),
    data_collator=transformers.DataCollatorForLanguageModeling(
        tokenizer, mlm=False)
)
# silence the warnings. Please re-enable for inference!
trainer.train()
