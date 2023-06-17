import socket
import sys
from typing import Callable
import json
from queue import Queue
from threading import Thread

import requests

NO_REQUIRED_PARAMS = 4
SERVER_PORT, PACKET_HEADER_DELIM, PACKET_START_DELIM, PACKET_END_DELIM = sys.argv[
    1 : 1 + NO_REQUIRED_PARAMS
]
sys.argv = [sys.argv[0]] + sys.argv[1 + NO_REQUIRED_PARAMS : len(sys.argv)]

SERVER_PORT = int(SERVER_PORT)

PACKET_START_DELIM, PACKET_END_DELIM, PACKET_HEADER_DELIM = (
    PACKET_START_DELIM.encode(),
    PACKET_END_DELIM.encode(),
    PACKET_HEADER_DELIM.encode(),
)


def debug(data: bytes):
    sys.stdout.buffer.write(data)
    sys.stdout.flush()


def debug_string(data: str):
    sys.stdout.buffer.write((data + "\n").encode())
    sys.stdout.flush()


def download_url(
    url: str, chunk_size=1024, progress_callback: Callable[[int, int], None] = None
):
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get("content-length", 0))
    downloaded_size = 0

    if progress_callback is not None:
        progress_callback(0, total_size)

    data = b""
    for chunk in response.iter_content(chunk_size=chunk_size):
        if chunk:
            data += chunk
            downloaded_size += len(chunk)
            if progress_callback is not None:
                progress_callback(downloaded_size, total_size)

    return data


def get_end_index(data: bytes):
    try:
        return data.index(PACKET_END_DELIM), len(PACKET_END_DELIM)
    except:
        return None, None


def get_start_index(data: bytes):
    try:
        return data.index(PACKET_START_DELIM), len(PACKET_START_DELIM)
    except:
        return None, None


def process_packet(
    packet: bytes, pending: bytes, on_complete_packet: Callable[[], bytes]
):
    remaining = pending + packet
    while len(remaining) > 0:
        start_index, start_len = get_start_index(remaining)
        if start_index is not None:
            end_index, end_len = get_end_index(remaining)
            if end_index is not None:
                on_complete_packet(remaining[start_index + start_len : end_index])
                remaining = remaining[end_index + end_len : len(remaining)]
            else:
                break
        else:
            return remaining
    return remaining


class Bridge:
    def __init__(self) -> None:
        self.stop = False
        self.to_main_queue = Queue()
        self.callbacks = []
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.connect(("127.0.0.1", SERVER_PORT))
        self.sockThread = Thread(target=self._run_tcp, daemon=True, group=None)
        self.sockThread.start()

    def ready(self):
        self.send("READY".encode("utf-8"), -1)
        while True:
            try:
                header, data = self.to_main_queue.get()
                for callback in self.callbacks:
                    callback(header["op"], data)

            except KeyboardInterrupt:
                break

    def _run_tcp(self):
        pendingData = b""
        while not self.stop:
            # receive a response from the server
            data = self.socket.recv(1024)
            pendingData = process_packet(data, pendingData, self.on_packet)

    def send(self, packet: bytes, op: int = 0):
        self._send(packet, op)

    def _send(self, packet, op: int = 0):
        packet_header = {"op": op}

        self.socket.sendall(
            PACKET_START_DELIM
            + json.dumps(packet_header).encode()
            + PACKET_HEADER_DELIM
            + packet
            + PACKET_END_DELIM
        )

    def kill(self):
        self.stop = True

    def on_packet(self, packet: bytes):
        header_delim_index = packet.index(PACKET_HEADER_DELIM)
        to_json = packet[0:header_delim_index].decode()
        packet_header = json.loads(to_json)
        packet_data = packet[
            header_delim_index + len(PACKET_HEADER_DELIM) : len(packet)
        ]
        self.to_main_queue.put((packet_header, packet_data))

    def add_on_packet(self, callback: Callable[[int, bytes], None]):
        self.callbacks.append(callback)
