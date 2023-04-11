from neural.datasets import NluDataset
from neural.engines import EntitiesEngine
import json
from neural.train import train_entities
with open('debug.json', 'r') as f:
    data = json.load(f)
    test = EntitiesEngine(data['intents'], 'entities.pt')
    prompt = 'say say say'
    print(
        f"GETIING ENTITIES FOR PROMPT: {prompt}\n", test.get_entities(prompt))
