import { AssistantContext, AssistantPlugin } from '@core/assistant';
import { ELoadableState } from '@core/base';
import { PythonProcess } from '@core/subprocess';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fs from 'fs';
import { BrowserWindow } from 'electron';
export class DesktopContext extends AssistantContext {
	plugin: DesktopPlugin;

	constructor(plugin: DesktopPlugin) {
		super();
		this.plugin = plugin;
	}

	override get id() {
		return 'desktop-io';
	}

	override get sessionId(): string {
		return this.id + '-user';
	}

	override async onLoad() {}

	override async reply(data: string): Promise<boolean> {
		let final = data + (data.endsWith('.') ? '' : '.');

		final = final.replaceAll('?', '.');

		this.plugin.tts?.sendAndWait(Buffer.from(final), 1);
		return true;
	}

	override getInput(
		prompt: string,
		timeout?: number | undefined
	): Promise<string | undefined> {
		return new Promise((res) => {
			this.reply(prompt);
			this.plugin.pendingCallback = (data: string) => {
				res(data);
			};
		});
	}

	override async replyImage(data: Buffer): Promise<boolean> {
		const imageDir = path.join(this.plugin.tempDir, uuidv4() + '.png');
		await fs.promises.writeFile(imageDir, data);
		const displayWindow = new BrowserWindow({});
		displayWindow.on('close', () => {
			fs.unlinkSync(imageDir);
		});
		await displayWindow.loadURL(`file:///${imageDir}`);
		return true;
	}
}

export default class DesktopPlugin extends AssistantPlugin {
	tts?: PythonProcess;
	stt?: PythonProcess;
	tempDir = '';
	pendingCallback: ((data: string) => void) | null = null;

	override get id(): string {
		return 'desktop';
	}

	override async onLoad(): Promise<void> {
		this.tts = new PythonProcess('tts.py', [this.dataPath]);
		this.stt = new PythonProcess('stt.py', [this.dataPath]);
		await this.stt.waitForState(ELoadableState.ACTIVE);
		await this.tts.waitForState(ELoadableState.ACTIVE);
		this.stt.on('onPacket', (_, pack) => {
			if (this.pendingCallback) {
				this.pendingCallback(pack.toString());
				this.pendingCallback = null;
				return;
			}

			bus.assistant.tryStartSkill(pack.toString(), new DesktopContext(this));
		});

		this.tempDir = path.join(this.dataPath, 'temp');

		try {
			await fs.promises.mkdir(this.tempDir, {
				recursive: true,
			});
		} catch (error) {
			console.error(error);
		}

		console.info('Using temp dir', this.tempDir);
	}
}
