import torch
import torchaudio
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
DEVICE = torch.device("cuda")
# Load the pre-trained model and processor
model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-base-960h").to(DEVICE)
processor = Wav2Vec2Processor.from_pretrained(
    "facebook/wav2vec2-base-960h")

audio, sample_rate = torchaudio.load("clip-1.wav")
print("Loaded audio with samplerate", sample_rate)
transcriptions = []

input_values = processor(audio, sampling_rate=sample_rate,
                         return_tensors="pt").input_values

labels = processor("your transcribed text here", return_tensors="pt").input_ids

print("Stuff", labels)
model.eval()
model = model.to(DEVICE)
input_values = input_values.to(DEVICE)

with torch.no_grad():
    logits = model(input_values.squeeze(0)).logits
predicted_ids = torch.argmax(logits, dim=-1)
transcriptions = processor.decode(predicted_ids[0])
print(transcriptions)
