from bridge import Bridge
import json
from neural import IntentsEngine, NEREngine
from typing import Union
import os

mainProcess = Bridge()
engine_intents: Union[IntentsEngine, None] = None


def on_packet(op, buffer: bytes):
    global engine_intents

    if op == 2:
        json_data = json.loads(buffer.decode("utf-8"))

        if engine_intents is None:
            engine_intents = IntentsEngine(
                list(json_data["tags"]).copy(),
                os.path.join(json_data["dir"], "intents.pt"),
            )
            engine_intents.ready()
        else:
            engine_intents.update_intents(list(json_data["tags"]).copy())
        mainProcess.send("Done".encode(), op)
    elif op == 1 and engine_intents is not None:
        intent = engine_intents.get_intent(buffer.decode("utf-8"))
        mainProcess.send(json.dumps({"intents": intent, "entities": []}).encode(), op)
    else:
        mainProcess.send(f"0|unk".encode(), op)


mainProcess.add_on_packet(on_packet)

mainProcess.ready()
