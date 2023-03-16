import { ELoadableState, Loadable } from '@core/base';
import { Awaitable } from '@core/types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import net from 'net';
import path from 'path';
import { createServer } from 'net';

function isPortAvailable(port: number, type: 'IPv4' | 'IPv6' = 'IPv4') {
	return new Promise((resolve) => {
		const server = require('http')
			.createServer()
			.listen(port, () => {
				server.close();
				resolve(true);
			})
			.on('error', () => {
				resolve(false);
			});
	});
}

class PortFinder {
	currentPort: number;
	pendingPortRequests: ((ports: [number, number]) => void)[] = [];
	isSearchingForPorts: boolean = false;
	constructor(startPort: number) {
		this.currentPort = startPort;
	}

	async searchForPorts() {
		this.isSearchingForPorts = true;

		const currentCallback = this.pendingPortRequests.pop();

		if (!currentCallback) {
			this.isSearchingForPorts = false;
			return;
		}

		while (!isPortAvailable(this.currentPort)) {
			this.currentPort += 2;
		}

		currentCallback([this.currentPort, this.currentPort + 1]);
		this.currentPort += 2;
		setImmediate(this.searchForPorts.bind(this));
	}

	async getAvailablePort(): Promise<[number, number]> {
		return new Promise<[number, number]>((res) => {
			this.pendingPortRequests.push(res);
			if (!this.isSearchingForPorts) {
				this.searchForPorts();
			}
		});
	}
}

const PORT_SEARCHER = new PortFinder(9000);

let LAST_PORT_USED = 9000;

const PACKET_START = '<pk-region>';
const PACKET_END = '<pk-region/>';

const [PACKET_START_BUFF, PACKET_END_BUFF] = [
	Buffer.from(PACKET_START),
	Buffer.from(PACKET_END),
];

export type SubProcessCreator<S extends SubProcess, T> = (master: T) => S;

export interface ISubProcessEvents {
	onProcessStdout: (chunk: Buffer) => Awaitable<void>;
	onProcessSpawned: () => Awaitable<void>;
	onProcessError: (chunk: Buffer) => Awaitable<void>;
	onProcessExit: (
		code: number | null,
		signal: NodeJS.Signals | null
	) => Awaitable<void>;
	onPacket: (op: number, packet: Buffer) => Awaitable<void>;
}

export class SubProcess extends Loadable {
	process?: ChildProcessWithoutNullStreams;
	serverPort: number;
	clientPort: number;
	filePath: string;
	tcpServer: net.Server;
	connectedClient?: net.Socket;
	pendingBuff: Buffer = Buffer.alloc(0);

	on: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	once: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	off: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	emit: <T extends keyof ISubProcessEvents>(
		eventName: T,
		...args: Parameters<ISubProcessEvents[T]>
	) => boolean;

	constructor(executable: string, file: string, args: string[] = []) {
		super();

		this.filePath = file;
		this.tcpServer = net.createServer();

		const onConnected = this.onClientConnected.bind(this);
		this.tcpServer.on('connection', onConnected);
		this.addBoundEvent(this.tcpServer, 'connection', onConnected);
		(async () => {
			const [s, c] = await PORT_SEARCHER.getAvailablePort();

			this.serverPort = s;
			this.clientPort = c;
			console.log(
				'Subprocess server on port',
				this.serverPort,
				'With client on port',
				this.clientPort
			);
			this.tcpServer.listen(this.serverPort, '127.0.0.1', () => {
				this.process = spawn(executable, [
					this.filePath,
					this.serverPort.toString(),
					this.clientPort.toString(),
					PACKET_START,
					PACKET_END,
					...args,
				]);

				const onSpawnCallback = () => this.emit('onProcessSpawned');
				this.process.on('spawn', onSpawnCallback);
				this.addBoundEvent(this.process, 'spawn', onSpawnCallback);

				const onStdOut = (c: Buffer) => this.emit('onProcessStdout', c);
				this.process.stdout.on('data', onStdOut);
				this.addBoundEvent(this.process.stdout, 'data', onStdOut);

				const onErrorCallback = (c: Buffer) => this.emit('onProcessError', c);
				this.process.stderr.on('data', onErrorCallback);
				this.addBoundEvent(this.process.stderr, 'data', onErrorCallback);

				const onExitCallback = (c: number | null, s: NodeJS.Signals | null) =>
					this.emit('onProcessExit', c, s);
				this.process.on('exit', onExitCallback);
				this.addBoundEvent(this.process, 'exit', onExitCallback);
			});
		})();
		this.once('onPacket', async () => {
			console.log(
				'Recieved inital packet from client on port',
				this.clientPort
			);
			await this.load();
		});
		this.on('onProcessError', (buff) => {
			console.log('Process Error', buff.toString());
		});
		this.on('onProcessStdout', (buff) => {
			console.log('Process Debug', buff.toString());
		});
	}

	async onClientConnected(socket: net.Socket) {
		this.connectedClient = socket;
		socket.on('data', (data) => {
			let currentData = data;
			while (currentData.length > 0) {
				const startIndex = currentData.indexOf(PACKET_START_BUFF);
				const endIndex = currentData.indexOf(PACKET_END_BUFF);
				const startOffset = startIndex + PACKET_START_BUFF.length;
				const endOffset = endIndex + PACKET_END_BUFF.length;

				if (this.pendingBuff.length === 0) {
					if (startIndex !== -1 && endIndex !== -1) {
						this._onPacket(currentData.slice(startOffset, endIndex));
						currentData = currentData.slice(endOffset, currentData.length - 1);
					} else if (startIndex !== -1) {
						this.pendingBuff = Buffer.concat([
							this.pendingBuff,
							currentData.slice(startOffset, currentData.length - 1),
						]);
						currentData = Buffer.alloc(0);
					}
				} else {
					if (endIndex !== -1) {
						this.pendingBuff = Buffer.concat([
							this.pendingBuff,
							currentData.slice(0, endIndex),
						]);
						this._onPacket(this.pendingBuff);
						this.pendingBuff = Buffer.alloc(0);
						currentData = currentData.slice(endOffset, currentData.length - 1);
					} else {
						this.pendingBuff = Buffer.concat([this.pendingBuff, currentData]);
						currentData = Buffer.alloc(0);
					}
				}
			}
		});
	}

	_onPacket(packet: Buffer) {
		this.emit(
			'onPacket',
			packet.slice(0, 4).readInt32BE(),
			packet.slice(4, packet.length)
		);
	}

	async send(data: Buffer, op: number = 0) {
		await this.waitForState(ELoadableState.ACTIVE);
		const opBuff = Buffer.alloc(4);
		opBuff.writeInt32BE(op);
		this.connectedClient?.write(
			Buffer.concat([
				PACKET_START_BUFF,
				Buffer.concat([opBuff, data]),
				PACKET_END_BUFF,
			])
		);
	}

	async sendAndWait(data: Buffer, op: number = 0) {
		await this.waitForState(ELoadableState.ACTIVE);
		return new Promise<[number, Buffer]>((resolve) => {
			const onPacketRecieved = (newOp: number, pack: Buffer) => {
				if (newOp === op) {
					resolve([newOp, pack]);
					this.off('onPacket', onPacketRecieved);
				}
			};

			this.on('onPacket', onPacketRecieved);
			this.send(data, op);
		});
	}
}

export class PythonProcess extends SubProcess {
	static PYTHON_FILE_PATHS = path.join(process.cwd(), 'py');
	static PYTHON_INTERPRETER_PATH = process.env.PYTHON_EXECUTABLE_PATH;
	constructor(file: string, args: string[] = []) {
		super(
			PythonProcess.PYTHON_INTERPRETER_PATH,
			path.join(PythonProcess.PYTHON_FILE_PATHS, file),
			args
		);
	}
}
