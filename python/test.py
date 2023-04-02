from bridge import Bridge
import time
import sys
import asyncio
from random import choice


testSocket = Bridge()

testSocket.send((' HELLO MODAFUKA ' * 100).encode())
while True:
    time.sleep(10)
