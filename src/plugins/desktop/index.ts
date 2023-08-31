import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { ELoadableState } from '@core/base';
import { PythonProcess } from '@core/subprocess';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fs from 'fs';
import { BrowserWindow, app } from 'electron';
import { digitsToWords } from '@core/conversion';
import { CgasApi } from '@core/singletons';
import { withChildProcess } from '@core/thread';

class BackgroundDesktopSkill extends AssistantSkill {
	override shouldExecute(instance: SkillInstance): boolean {
		return true;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		await new Promise<void>((res) => {
			console.log("This will run forever")

			app.on('will-quit',()=>{
				console.log("That thins has finally stopped running")
				res()
			})
		})
	}
}

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

		final = final
			.replaceAll('?', '.')
			.replaceAll(':', ' ')
			.replaceAll('am', 'ai em')
			.replaceAll('pm', 'pee em');

		final = digitsToWords(final);
		this.plugin.window?.webContents.executeJavaScript(
			`displayText("${data}",10000)`
		);
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

	override async replyImage(data: Buffer | string): Promise<boolean> {
		let uri = '';
		if (typeof data === 'string') {
			uri = data;
		} else {
			const uploadInfo = await CgasApi.get().upload(
				uuidv4() + '.png',
				data
			);
			if (!uploadInfo) return false;
			uri = uploadInfo.url;
		}

		const displayWindow = new BrowserWindow({});
		// displayWindow.on('close', () => {
		// 	fs.unlinkSync(imageDir);
		// });
		await displayWindow.loadURL(uri);
		return true;
	}
}

export default class DesktopPlugin extends AssistantPlugin {
	tts: PythonProcess;
	stt: PythonProcess;
	window?: BrowserWindow;

	constructor() {
		super();
		this.tts = new PythonProcess('tts.py', [this.dataPath]);
		this.stt = new PythonProcess('stt.py', [this.dataPath]);
		// this.window = new BrowserWindow({
		// 	show: true,
		// 	autoHideMenuBar: true,
		// });
	}

	pendingCallback: ((data: string) => void) | null = null;

	override get id(): string {
		return 'desktop';
	}

	override async onLoad(): Promise<void> {
		await this.stt.waitForState(ELoadableState.ACTIVE);
		await this.tts.waitForState(ELoadableState.ACTIVE);

		this.window?.loadFile(path.join(this.dataPath, 'index.html'));
		//this.window.webContents.openDevTools();
		this.stt.on('onPacket', (_, pack) => {
			if (this.pendingCallback) {
				this.pendingCallback(pack.toString());
				this.pendingCallback = null;
				return;
			}

			this.assistant.tryStartSkill(
				pack.toString(),
				new DesktopContext(this)
			);
		});

		this.assistant.startSkill(
			new DesktopContext(this),
			new BackgroundDesktopSkill()
		);
	}

	override get dirname() {
		return __dirname;
	}
}
