import { ELoadableState, Loadable } from '@core/base';
import { Awaitable } from '@core/types';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import net from 'net';
import path from 'path';
// import { createServer } from 'net';

// function isPortAvailable(port: number, type: 'IPv4' | 'IPv6' = 'IPv4') {
// 	return new Promise((resolve) => {
// 		const server = require('http')
// 			.createServer()
// 			.listen(port, () => {
// 				server.close();
// 				resolve(true);
// 			})
// 			.on('error', () => {
// 				resolve(false);
// 			});
// 	});
// }

// class PortFinder {
// 	currentPort: number;
// 	pendingPortRequests: ((ports: [number, number]) => void)[] = [];
// 	isSearchingForPorts: boolean = false;
// 	constructor(startPort: number) {
// 		this.currentPort = startPort;
// 	}

// 	async searchForPorts() {
// 		this.isSearchingForPorts = true;

// 		const currentCallback = this.pendingPortRequests.pop();

// 		if (!currentCallback) {
// 			this.isSearchingForPorts = false;
// 			return;
// 		}

// 		while (!isPortAvailable(this.currentPort)) {
// 			this.currentPort += 2;
// 		}

// 		currentCallback([this.currentPort, this.currentPort + 1]);
// 		this.currentPort += 2;
// 		setImmediate(this.searchForPorts.bind(this));
// 	}

// 	async getAvailablePort(): Promise<[number, number]> {
// 		return new Promise<[number, number]>((res) => {
// 			this.pendingPortRequests.push(res);
// 			if (!this.isSearchingForPorts) {
// 				this.searchForPorts();
// 			}
// 		});
// 	}
// }

// const PORT_SEARCHER = new PortFinder(9000);

// let LAST_PORT_USED = 9000;

const PACKET_START = `<pk-region-${uuidv4()}>`;
const PACKET_END = `</pk-region-${uuidv4()}>`;
const PACKET_HEADER_DELIM = `<pk-header-end-${uuidv4()}/>`;

const [PACKET_START_BUFF, PACKET_END_BUFF, PACKET_HEADER_DELIM_BUFF] = [
	Buffer.from(PACKET_START),
	Buffer.from(PACKET_END),
	Buffer.from(PACKET_HEADER_DELIM),
];

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
	filePath: string;
	tcpServer: net.Server;
	connectedClient?: net.Socket;
	pendingBuff: Buffer = Buffer.alloc(0);

	on!: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	once!: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	off!: <T extends keyof ISubProcessEvents>(
		eventName: T,
		listener: ISubProcessEvents[T]
	) => this;

	emit!: <T extends keyof ISubProcessEvents>(
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

		this.tcpServer.listen(0, '127.0.0.1', () => {
			const address = this.tcpServer.address() as net.AddressInfo;

			this.process = spawn(executable, [
				this.filePath,
				address.port.toString(),
				PACKET_HEADER_DELIM,
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
			console.info(`Started process ${this.filePath}`);

			// this.on('onProcessError', (b) => {
			// 	let debug = b.toString();
			// 	while (debug.startsWith('\r')) {
			// 		debug = debug.slice(1);
			// 	}
			// 	console.info(debug);
			// });

			// this.on('onProcessStdout', (b) => {
			// 	let debug = b.toString();
			// 	while (debug.startsWith('\r')) {
			// 		debug = debug.slice(1);
			// 	}
			// 	console.info(debug);
			// });j
		});

		this.on('onPacket', (op) => {
			if (this.state !== ELoadableState.ACTIVE && op === -1) {
				this.load();
				console.info('PROCESS READY', this.filePath);
			}
		});
	}

	async onClientConnected(socket: net.Socket) {
		this.connectedClient = socket;
		let pendingData: Buffer = Buffer.alloc(0);
		socket.on('data', (data) => {
			let currentData = Buffer.concat([pendingData, data]);

			while (currentData.length > 0) {
				const startIndex = currentData.indexOf(PACKET_START_BUFF);

				if (startIndex >= 0) {
					const endIndex = currentData.indexOf(PACKET_END_BUFF);

					if (endIndex >= 0) {
						this._onPacket(
							currentData.slice(startIndex + PACKET_START_BUFF.length, endIndex)
						);
						currentData = currentData.slice(endIndex + PACKET_END_BUFF.length);
					} else {
						break;
					}
				} else {
					pendingData = currentData;
					currentData = Buffer.alloc(0);
				}
			}

			pendingData = currentData;
		});
	}

	_onPacket(packet: Buffer) {
		const headerIndex = packet.indexOf(PACKET_HEADER_DELIM);
		const packetHeader = JSON.parse(packet.slice(0, headerIndex).toString());
		const actualPacket = packet.slice(headerIndex + PACKET_HEADER_DELIM.length);
		this.emit('onPacket', packetHeader['op'], actualPacket);
	}

	async send(data: Buffer, op: number = 0) {
		await this.waitForState(ELoadableState.ACTIVE);
		// can add more stuff here later and it will just work
		const packetHeader = {
			op: op,
		};

		const opBuff = Buffer.from(JSON.stringify(packetHeader));

		this.connectedClient?.write(
			Buffer.concat([
				PACKET_START_BUFF,
				opBuff,
				PACKET_HEADER_DELIM_BUFF,
				data,
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
	static PYTHON_FILE_PATHS = path.join(process.cwd(), 'python');
	static PYTHON_INTERPRETER_PATH = process.env.PYTHON_EXECUTABLE_PATH;
	constructor(file: string, args: string[] = []) {
		super(
			PythonProcess.PYTHON_INTERPRETER_PATH,
			path.join(PythonProcess.PYTHON_FILE_PATHS, file),
			args
		);
	}
}
