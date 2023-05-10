import json
import time

from bridge import Bridge

sock = Bridge()


sock.ready()
while True:
    time.sleep(10)
