from gpt4all import GPT4All




model = GPT4All("wizardLM-13B-Uncensored.ggmlv3.q4_0.bin")

total = ""


for token in model.generate("""Intents:\nCALL = Make a phone call\nPLAY = Play music\nUNK = Unknown intent\nA chat between a user and an intent classifier\nUSER:Play location by dave\nCLASSIFIER:PLAY\nUSER:Launch spotify and play sugar by maroon 5""", streaming=True):
    total += token
    print(total)
