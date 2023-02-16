from sys import stdout, stdin, argv


def encode_message(message: bytes):
    length = len(message)
    return length.to_bytes(16, 'big')  # + message


print()
print("BYTES TEST 2")
# stdout.buffer.write(encode_message("BYTES TEST 2".encode()))
# stdout.buffer.write(encode_message("BYTES TEST 3".encode()))
# stdout.buffer.write(encode_message("BYTES TEST 4".encode()))
