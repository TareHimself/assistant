from bridge import Bridge, debug_string
import time
from os import getcwd, path
import json
from neural import IntentsEngine
from typing import Union

mainProcess = Bridge()
engine: Union[IntentsEngine, None] = None


def on_packet(op, buffer: bytes):
    global engine
    if op == 2:
        json_data = json.loads(buffer.decode())
        if engine is None:
            engine = IntentsEngine(list(json_data[
                'tags']).copy(), json_data['model'])
        else:
            engine.update_intents(
                list(json_data['tags']).copy())
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
