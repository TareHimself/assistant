import socket
import sys
import os
from typing import Union, Callable
from uuid import uuid4
from math import ceil
from datetime import datetime
from queue import Queue
import pyaudio
from threading import Thread

NO_REQUIRED_PARAMS = 4
SERVER_PORT, CLIENT_PORT, PACKET_START_DELIM, PACKET_END_DELIM = sys.argv[
    1:1 + NO_REQUIRED_PARAMS]
sys.argv = [sys.argv[0]] + sys.argv[1 + NO_REQUIRED_PARAMS:len(sys.argv)]

SERVER_PORT, CLIENT_PORT = int(SERVER_PORT), int(CLIENT_PORT)

PACKET_START_DELIM, PACKET_END_DELIM = PACKET_START_DELIM.encode(
), PACKET_END_DELIM.encode()


def debug(data: bytes):
    sys.stdout.buffer.write(data)
    sys.stdout.flush()


def debug_string(data: str):
    sys.stdout.buffer.write((data + '\n').encode())
    sys.stdout.flush()


# def pad(num: int, length: int = 2):
#     final = str(num)
#     current_len = len(final)
#     if current_len < length:
#         final = ("0" * (length - current_len)) + final

#     return final


# def make_header(packet_id: str, index: int = 0, total: int = 0):
#     index_s = str(index)
#     total_s = str(total)
#     index_s = ("0"*(HEADER_PAD_AMMOUNT - len(index_s))) + index_s
#     total_s = ("0"*(HEADER_PAD_AMMOUNT - len(total_s))) + total_s

#     return f"{packet_id}|{index_s}|{total_s}".encode('utf-8')


# def decode_header(packet: bytes):
#     packet_id, part, total = packet[0:HEADER_LENGTH].decode('utf-8').split("|")
#     packet = packet[HEADER_LENGTH:len(packet)]

#     return packet_id, int(part), int(total), packet

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


def process_packet(packet: bytes, pending: bytes, on_complete_packet: Callable[[], bytes]):
    remaining = pending + packet
    while len(remaining) > 0:
        start_index, start_len = get_start_index(remaining)
        if start_index is not None:
            end_index, end_len = get_end_index(remaining)
            if end_index is not None:
                on_complete_packet(
                    remaining[start_index + start_len:end_index])
                remaining = remaining[end_index + end_len:len(remaining)]
            else:
                break
        else:
            end_index, end_len = get_end_index(remaining)
            if end_index is not None:
                raise "Something unholy has occured"
            else:
                return remaining
    return remaining


class Bridge:
    def __init__(self) -> None:
        self.stop = False
        self.callbacks = []
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.connect(('127.0.0.1', SERVER_PORT))
        self.sockThread = Thread(target=self._run_tcp, daemon=True, group=None)
        self.sockThread.start()

    def ready(self):
        self.send("READY".encode('utf-8'))

    def _run_tcp(self):
        pendingData = b''
        while not self.stop:
            # receive a response from the server
            data = self.socket.recv(1024)
            pendingData = process_packet(data, pendingData, self.on_packet)

    def send(self, packet: bytes, op: int = 0):
        self._send(packet, op)

    def _send(self, packet, op: int = 0):
        self.socket.sendall(PACKET_START_DELIM +
                            op.to_bytes(4, 'big') + packet + PACKET_END_DELIM)

    def kill(self):
        self.stop = True

    def on_packet(self, packet: bytes):
        for callback in self.callbacks:
            callback(int.from_bytes(packet[0:4], "big"), packet[4:len(packet)])

    def add_on_packet(self, callback: Callable[[int, bytes], None]):
        self.callbacks.append(callback)


CHANNELS = 1
DEFAULT_INPUT_DEVICE = None  # 4
DEFAULT_SAMPLE_RATE = 16000
MAIN_STREAM_BLOCK_SIZE = 8000
FORMAT = pyaudio.paInt16


class AudioStream(Thread):
    def __init__(self, callback, chunk=None, device=DEFAULT_INPUT_DEVICE, samplerate=DEFAULT_SAMPLE_RATE):
        super().__init__(daemon=True, group=None)
        self.chunk = chunk
        self.samplerate = samplerate
        self.callback = callback
        self.device = device

    def run(self):
        while True:
            audio = pyaudio.PyAudio()

            # A frame must be either 10, 20, or 30 ms in duration for webrtcvad
            FRAME_DURATION = 30
            CHUNK = self.chunk if self.chunk else int(
                self.samplerate * FRAME_DURATION / 1000)

            stream = audio.open(input_device_index=self.device,
                                format=FORMAT,
                                channels=CHANNELS,
                                rate=self.samplerate,
                                input=True,
                                frames_per_buffer=CHUNK)

            while True:
                if self.callback and callable(self.callback):
                    audio_chunk = stream.read(
                        CHUNK, exception_on_overflow=False)
                    if audio_chunk:
                        self.callback(audio_chunk)

                # self.ProcessJobs()
