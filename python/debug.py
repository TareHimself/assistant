
from neural.engines import EntitiesEngine, IntentsEngine
import json
with open('debug.json', 'r') as f:
    data = json.load(f)
    test = IntentsEngine(data['intents'], 'en.pt')
    prompt = 'I need the time babby gurl'
    print(
        f"GETIING ENTITIES FOR PROMPT: {prompt}\n", test.get_intent(prompt))
