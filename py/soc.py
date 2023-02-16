import socket
import sys
from typing import Union, Callable
from uuid import uuid4
from math import ceil
from datetime import datetime
from threading import Thread
DEBUG_FILE = open('debug.txt', 'w')
NO_REQUIRED_PARAMS = 6
PACKET_DATA_SIZE, PACKET_SIZE, HEADER_LENGTH, HEADER_PAD_AMMOUNT, SOCKET_PORT, SERVER_PORT = list(
    map(int, sys.argv[1:1 + NO_REQUIRED_PARAMS]))
sys.argv = [sys.argv[0]] + sys.argv[1 + NO_REQUIRED_PARAMS:len(sys.argv)]

SERVER_ADDRESS = ('localhost', SERVER_PORT)
READY_PACKET_ID = "0"*HEADER_PAD_AMMOUNT


def debug(data: bytes):
    sys.stdout.buffer.write(data)
    sys.stdout.flush()


def debug_string(data: str):
    sys.stdout.buffer.write(data.encode())
    sys.stdout.flush()


def pad(num: int, length: int = 2):
    final = str(num)
    current_len = len(final)
    if current_len < length:
        final = ("0" * (length - current_len)) + final

    return final


def make_header(packet_id: str, index: int = 0, total: int = 0):
    index_s = str(index)
    total_s = str(total)
    index_s = ("0"*(HEADER_PAD_AMMOUNT - len(index_s))) + index_s
    total_s = ("0"*(HEADER_PAD_AMMOUNT - len(total_s))) + total_s

    return f"{packet_id}|{index_s}|{total_s}".encode('utf-8')


def decode_header(packet: bytes):
    packet_id, part, total = packet[0:HEADER_LENGTH].decode('utf-8').split("|")
    packet = packet[HEADER_LENGTH:len(packet)]

    return packet_id, int(part), int(total), packet


class ProcessSocket:
    def __init__(self) -> None:
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((SERVER_ADDRESS[0], SOCKET_PORT))
        self.callbacks = []
        self.pending_messages = {}
        self.active = True
        self.t1 = Thread(
            group=None, target=self._recv_packets, daemon=True)
        self.t1.start()
        self.pending_bytes: dict[str, list[tuple[int, bytes]]] = {}
        self.callbacks = []

    def ready(self):
        self.send(READY_PACKET_ID, "READY".encode('utf-8'),
                  SERVER_ADDRESS)

    def get_complete_packet(self):
        raw_packet, sender = self.socket.recvfrom(PACKET_SIZE)
        packet_id, index, total, packet = decode_header(raw_packet)

        if index == 0 and index == total:
            return packet_id, packet, sender
        else:
            if packet_id not in self.pending_bytes.keys():
                self.pending_bytes[packet_id] = []

            self.pending_bytes[packet_id].append((index, packet))

            if len(self.pending_bytes[packet_id]) == total + 1:
                all_parts = self.pending_bytes[packet_id]
                del self.pending_bytes[packet_id]
                all_parts.sort(key=lambda x: x[0])
                combined = b''.join(map(lambda a: a[1], all_parts))
                return packet_id, combined, sender
        return None

    def _recv_packets(self):
        while True:
            try:
                data = self.get_complete_packet()
                if data is not None:
                    p_id, packet, add = data
                    self.handle_new_packet(p_id, packet, add)
            except socket.timeout:
                break

        self.socket.close()

    def handle_new_packet(self, packet_id: str, packet: bytes, address: tuple[str, int]):
        self.on_packet(packet_id, packet, address)

    def send(self, packet_id: str,  packet: bytes, address: tuple[str, int]):
        self._send(packet_id, packet, address)

    def _send(self, packet_id: str, packet: bytes, address: tuple[str, int]):
        if len(packet) > PACKET_DATA_SIZE:
            packet_size = len(packet)
            parts_total = int(ceil(packet_size / PACKET_DATA_SIZE))

            for i in range(parts_total):
                part = packet[i * PACKET_DATA_SIZE:(
                    i + 1) * PACKET_DATA_SIZE] if i < parts_total - 1 else packet[i * PACKET_DATA_SIZE:packet_size]

                self.socket.sendto(make_header(
                    packet_id, i, parts_total - 1) + part, address)
        else:
            self.socket.sendto(make_header(packet_id) + packet, address)

    def kill(self):
        self.socket.settimeout(1)

    def on_packet(self, packet_id: str, packet: bytes, address: tuple[str, int]):
        for callback in self.callbacks:
            callback(packet_id, packet, address)

    def add_on_packet(self, callback: Callable[[str, bytes, tuple[str, int]], None]):
        self.callbacks.append(callback)
