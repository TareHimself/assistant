import { ELoadableState, Loadable } from '@core/base';
import { Awaitable } from '@core/types';
import { pad } from '@core/utils';
import { spawn, ChildProcessWithoutNullStreams, Serializable, SendHandle } from 'child_process';
import { createSocket, Socket, RemoteInfo } from 'dgram'
import path from 'path';
const MAX_PACKET_DATA_SIZE = 1024 * 1;
const HEADER_PAD_AMMOUNT = 9;
const SERVER_ADDRESS = 'localhost';
const READY_PACKET_ID = pad(0, HEADER_PAD_AMMOUNT)
const MAX_PACKET_ID = Math.pow(10, HEADER_PAD_AMMOUNT)
const RESERVED_PACKET_IDS: { [key: string]: boolean } = {}
export {
    RESERVED_PACKET_IDS
}

let packet_index = 0;

export function makeId() {
    let id = packet_index;
    packet_index = (packet_index + 1) % MAX_PACKET_ID
    if (packet_index === 0) packet_index = 1
    while (RESERVED_PACKET_IDS[id]) {
        id = packet_index
        packet_index = (packet_index + 1) % MAX_PACKET_ID
        if (packet_index === 0) packet_index = 1
    }

    RESERVED_PACKET_IDS[id] = true

    return pad(id, HEADER_PAD_AMMOUNT)
}

const HEADER_LENGTH = makePartHeader(makeId()).length
const MAX_PACKET_SIZE = MAX_PACKET_DATA_SIZE - HEADER_LENGTH

export function makePartHeader(id: ReturnType<typeof makeId>, index = 0, total = 0) {
    return Buffer.from(`${id}|${pad(index, HEADER_PAD_AMMOUNT)}|${pad(total, HEADER_PAD_AMMOUNT)}`)
}

export function getPartHeader(part: Buffer): [string, number, number] {
    const [packet_id, index, total] = part.subarray(0, HEADER_LENGTH).toString('utf-8').split("|")
    return [packet_id, parseInt(index, 10), parseInt(total, 10)]
}

export function getPartData(part: Buffer): Buffer {
    return part.subarray(HEADER_LENGTH, part.length)
}


export function toParts(packetId: string, data: Buffer) {
    const asBuff = Buffer.from(data);

    const parts: Buffer[] = [];

    if (asBuff.length <= MAX_PACKET_SIZE) {
        parts.push(Buffer.concat([makePartHeader(packetId), asBuff]));
    }
    else {
        const total = Math.ceil(asBuff.length / MAX_PACKET_SIZE)
        for (let i = 0; i < total; i++) {
            if (i !== total - 1) {
                parts.push(Buffer.concat([makePartHeader(packetId, i, total - 1), asBuff.subarray(i * MAX_PACKET_SIZE, (i + 1) * MAX_PACKET_SIZE)]));
            }
            else {
                parts.push(Buffer.concat([makePartHeader(packetId, i, total - 1), asBuff.subarray(i * MAX_PACKET_SIZE, asBuff.length)]));
            }
        }
    }

    return parts
}

export function getPartInfo(part: Buffer): [string, number, number, Buffer] {
    return [...getPartHeader(part.subarray(0, HEADER_LENGTH)), part.subarray(HEADER_LENGTH, part.length)]
}

export function fromParts(parts: [number, Buffer][]) {
    return parts.sort((a, b) => a[0] - b[0]).reduce((total, [_, fragment]) => {
        return Buffer.concat([total, fragment])
    }, Buffer.alloc(0));
}

export interface ISubProcessMasterEvents {
    onPacket: (id: string, packet: Buffer, address: RemoteInfo) => Awaitable<void>
}

export type SendAndWaitData = [string, Buffer, RemoteInfo]

export type SubProcessCreator<S extends SubProcess, T> = (master: T) => S
export class SubProcessMaster extends Loadable {
    clients: Map<number, SubProcess> = new Map()
    sock: Socket;
    port: number;
    currentParts: Map<string, [number, Buffer][]> = new Map();
    constructor(port: number) {
        super();
        this.port = port
        this.sock = createSocket('udp4')
        const onMessageCallback = this.onSocketMessage.bind(this)
        this.sock.on('message', onMessageCallback)
        this.addBoundEvent(this.sock, 'message', onMessageCallback);
        this.load()
    }



    on: <T extends keyof ISubProcessMasterEvents>(eventName: T, listener: ISubProcessMasterEvents[T]) => this

    off: <T extends keyof ISubProcessMasterEvents>(eventName: T, listener: ISubProcessMasterEvents[T]) => this

    emit: <T extends keyof ISubProcessMasterEvents>(eventName: T, ...args: Parameters<ISubProcessMasterEvents[T]>) => boolean

    async onLoad(): Promise<void> {
        await new Promise<void>((r => this.sock.bind(this.port, SERVER_ADDRESS, r)))
        console.log("Server Up")
    }

    async onSocketMessage(part: Buffer, rinfo: RemoteInfo) {
        const [packet_id, index, total] = getPartHeader(part)
        if (!this.currentParts.has(packet_id)) {
            this.currentParts.set(packet_id, [])
        }

        this.currentParts.get(packet_id)!.push([index, getPartData(part)])

        if (this.currentParts.get(packet_id)!.length === total + 1) {
            this.onFullPacketRecieved(packet_id, fromParts(this.currentParts.get(packet_id)!), rinfo)
            this.currentParts.delete(packet_id)
        }
    }

    async onFullPacketRecieved(packetId: string, packet: Buffer, address: RemoteInfo) {
        delete RESERVED_PACKET_IDS[packetId]
        if (packetId === READY_PACKET_ID) {
            this.clients.get(address.port)!.load()
            return;
        }

        this.emit('onPacket', packetId, packet, address);
        this.clients.get(address.port)?.onPacket(packetId, packet, address);
    }

    async register(sub: SubProcess) {
        this.clients.set(sub.port, sub)
        return sub
    }

    send(port: number, data: Buffer) {
        const packet_id = makeId()
        toParts(packet_id, data).forEach((p) => {
            this.sock.send(p, port, SERVER_ADDRESS)
        })
    }


    sendAndWait(port: number, data: Buffer, timeout?: number) {
        return new Promise<SendAndWaitData | null>((resolve, reject) => {
            const packet_id = makeId()

            let activeTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

            const onPacket = (packetId: string, packet: Buffer, address: RemoteInfo) => {
                if (packet_id !== packetId) return;

                if (activeTimeout) clearTimeout(activeTimeout)
                this.off('onPacket', onPacket);

                resolve([packetId, packet, address]);
            }

            const onTimeout = () => {
                this.off('onPacket', onPacket)

                if (activeTimeout) clearTimeout(activeTimeout)

                resolve(null);
            }

            if (timeout) activeTimeout = setTimeout(onTimeout.bind(this), timeout)

            this.on('onPacket', onPacket)

            toParts(packet_id, data).forEach((p) => {
                this.sock.send(p, port, SERVER_ADDRESS)
            })
        })
    }
}

export class SubProcess extends Loadable {
    process: ChildProcessWithoutNullStreams;
    clientId: string;
    port: number;
    server: SubProcessMaster;
    filePath: string;
    constructor(executable: string, file: string, port: number, args: string[] = []) {
        super();
        this.server = bus.SubProcessMaster;
        this.filePath = file
        this.port = port
        this.server.register(this);
        this.process = spawn(executable, [this.filePath, MAX_PACKET_SIZE.toString(), MAX_PACKET_DATA_SIZE.toString(), HEADER_LENGTH.toString(), HEADER_PAD_AMMOUNT.toString(), port.toString(), this.server.port.toString(), ...args])

        const onSpawnCallback = this.onSpawn.bind(this);
        this.process.on('spawn', onSpawnCallback);
        this.addBoundEvent(this.process, 'spawn', onSpawnCallback);

        const onStdOut = this.onDebug.bind(this);
        this.process.stdout.on('data', onStdOut);
        this.addBoundEvent(this.process.stdout, 'data', onStdOut);

        const onErrorCallback = this.onError.bind(this);
        this.process.stderr.on('data', onErrorCallback)
        this.addBoundEvent(this.process.stderr, 'data', onErrorCallback);

        const onExitCallback = this.onExit.bind(this);
        this.process.on('exit', onExitCallback);
        this.addBoundEvent(this.process, 'exit', onExitCallback);
    }

    async onLoad(): Promise<void> {
        console.log("Process on port", this.port, "Ready")
    }

    private onSpawn() {
        console.log("Process on port", this.port, "Spawned")
    }

    private onExit(code: number | null, signal: NodeJS.Signals | null) {
        console.log("Process on port", this.port, "Exited:", code)
    }

    private onDebug(chunk: Buffer) {
        console.log("Process on port", this.port, "DEBUG:", chunk.toString('utf-8'))
    }

    private onError(chunk: Buffer) {
        console.error("Process on port", this.port, "ERROR:", chunk.toString('utf-8'))
    }

    async onPacket(packetId: string, packet: Buffer, address: RemoteInfo) {
    }

    async send(data: Buffer) {
        await this.waitForState(ELoadableState.ACTIVE)
        this.server.send(this.port, data)
    }

    async sendAndWait(data: Buffer, timeout?: number) {
        await this.waitForState(ELoadableState.ACTIVE)
        return await this.server.sendAndWait(this.port, data, timeout)
    }
}

export class PythonProcess extends SubProcess {
    static PYTHON_FILE_PATHS = path.join(process.cwd(), 'py')
    static PYTHON_INTERPRETER_PATH = `C:\\Users\\Taree\\anaconda3\\envs\\assistant\\python.exe`
    constructor(file: string, port: number, args: string[] = []) {
        super(PythonProcess.PYTHON_INTERPRETER_PATH, path.join(PythonProcess.PYTHON_FILE_PATHS, file), port, args);
    }

    async onPacket(packetId: string, packet: Buffer, address: RemoteInfo) {
    }
}