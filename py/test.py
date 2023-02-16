from soc import ProcessSocket
import time
import sys
import asyncio
from random import choice

testSocket = ProcessSocket()


def on_packet(packet_id: str, packet: bytes, address: tuple[str, int]):
    testSocket.send(packet_id, "YO".encode(), address)


testSocket.add_on_packet(on_packet)

testSocket.ready()
while True:
    time.sleep(10)
