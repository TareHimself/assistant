
from neural.engines import IntentsEngine
import json
with open('debug.json', 'r') as f:
    data = json.load(f)
    test = IntentsEngine(data['intents'], 'entities.pt')
    prompt = 'say say say'
    print(
        f"GETIING ENTITIES FOR PROMPT: {prompt}\n", test.get_entities(prompt))
