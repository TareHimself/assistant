from bridge import Bridge, debug_string
import time
from os import getcwd, path
import json
from neural import IntentsEngine
from typing import Union

mainProcess = Bridge()

INTENTS_FILE_PATH = path.join(getcwd(), 'intents.json')
MODEL_FILE_PATH = path.join(getcwd(), 'intent_model.pt')


engine: Union[IntentsEngine, None] = None


def on_packet(op, buffer: bytes):
    global engine
    if op == 2:
        if engine is None:
            engine = IntentsEngine(list(json.loads(buffer.decode())[
                'tags']).copy(), MODEL_FILE_PATH)
        else:
            engine.update_intents(
                list(json.loads(buffer.decode())['tags']).copy())
        mainProcess.send('Done'.encode(), op)
    elif op == 1 and engine is not None:
        confidence, intent = engine.get_intent(buffer.decode())
        mainProcess.send(f'{confidence}|{intent}'.encode(), op)
    else:
        mainProcess.send(f'0|unk'.encode(), op)


mainProcess.add_on_packet(on_packet)
mainProcess.ready()


while True:
    time.sleep(10)
