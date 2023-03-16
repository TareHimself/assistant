import { ELoadableState, Loadable, LoadableWithId } from './base';
import { PLUGINS_PATH } from './paths';
import { PythonProcess, SubProcess } from './subprocess';
import { IIntent } from './types';
import * as fs from 'fs/promises';
import path from 'path';
import { Client } from 'express-websocket-proxy';
import { compareTwoStrings } from 'string-similarity';

export abstract class AssistantSkill<T extends any = any> extends Loadable {
	constructor() {
		super();
	}

	get intents(): IIntent[] {
		return [];
	}

	async dataExtractor(intent: string, prompt: string): Promise<T> {
		throw new Error('Data extractor not implemented');
	}

	shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return true;
	}

	async execute(
		intent: string,
		source: AssistantContext,
		prompt: string,
		data: T
	) {
		source.reply('This skill has not yet been implemented.');
	}
}

export class Assistant extends Loadable {
	nluProcess: PythonProcess = new PythonProcess('intents.py');
	currentSkills: Map<string, AssistantSkill[]> = new Map();
	currentPlugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	bIsTrainingIntents: boolean = false;
	intents: { [key: string]: string[] } = {};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	tts: PythonProcess = new PythonProcess('tts.py');
	stt: PythonProcess = new PythonProcess('stt.py');
	bIsExpectingCommand: boolean = false;
	static WAKE_WORD = 'alice';
	constructor() {
		super();
		console.log('Loading assistant');
		this.load();
	}

	override async onLoad() {
		console.log('Loading plugins');
		const plugins = await fs.readdir(PLUGINS_PATH);

		await Promise.all(
			plugins.map((plugin) =>
				this.usePlugin(
					new (require(path.join(
						PLUGINS_PATH,
						plugin,
						'index.js'
					)).default)() as AssistantPlugin
				)
			)
		);
		console.log('Plugins loaded');
		console.log('Waiting for tts process');
		await this.tts.waitForState(ELoadableState.ACTIVE);
		console.log('Waiting for stt process');
		await this.stt.waitForState(ELoadableState.ACTIVE);
		console.log('Waiting for nlu process');
		await this.nluProcess.waitForState(ELoadableState.ACTIVE);
		console.log('Training intents in nlu process');
		await this.trainIntents();
		this.stt.on('onPacket', (_, pack) => {
			this.tryStartSkill(pack.toString(), new DefaultContext());
		});
		console.log('assistant ready');
	}

	async trainIntents() {
		if (this.bIsTrainingIntents) return;
		this.bIsTrainingIntents = true;

		const intentsToTrain = Object.keys(this.intents).reduce<IIntent[]>(
			(all, intent) => {
				all.push({
					tag: intent,
					examples: this.intents[intent],
				});

				return all;
			},
			[]
		);

		await this.nluProcess.sendAndWait(
			Buffer.from(
				JSON.stringify({
					tags: intentsToTrain,
				})
			),
			2
		);

		this.bIsTrainingIntents = false;
	}

	getPlugin(plugin: string) {
		return this.currentPlugins.get(plugin);
	}

	async useSkill(skill: AssistantSkill) {
		await skill.load();
		skill.intents.forEach((intent) => {
			if (!this.intents[intent.tag]) {
				this.intents[intent.tag] = [];
			}

			this.intents[intent.tag].push(...intent.examples);

			if (!this.currentSkills.has(intent.tag)) {
				this.currentSkills.set(intent.tag, []);
			}

			this.currentSkills.get(intent.tag)?.push(skill);
		});
	}

	async usePlugin(plugin: AssistantPlugin) {
		await plugin.load();
		const skills = await plugin.getSkills();
		await Promise.all(skills.map((skill) => this.useSkill(skill)));
		return this;
	}

	async getIntent(phrase: string): Promise<[number, string]> {
		const [_, nluPacket] = await this.nluProcess.sendAndWait(
			Buffer.from(phrase),
			1
		);
		const dataRecieved = nluPacket.toString().split('|');
		return [parseFloat(dataRecieved[0]), dataRecieved[1]];
	}

	async tryStartSkill(
		prompt: string,
		source: AssistantContext,
		bIsVerifiedPrompt: boolean = false
	) {
		prompt = prompt.trim();

		if (!bIsVerifiedPrompt) {
			if (
				prompt.toLowerCase() === Assistant.WAKE_WORD &&
				!this.bIsExpectingCommand
			) {
				this.bIsExpectingCommand = true;
				source.reply('Yes?');
				return;
			} else if (this.bIsExpectingCommand) {
				if (!prompt.toLowerCase().startsWith(Assistant.WAKE_WORD)) {
					prompt = `${Assistant.WAKE_WORD} ` + prompt;
				}
				this.bIsExpectingCommand = false;
			}

			const similarity = compareTwoStrings(
				Assistant.WAKE_WORD,
				prompt.toLowerCase().split(' ')[0]
			);

			//console.log(prompt, similarity);
			if (!prompt.toLowerCase().startsWith(Assistant.WAKE_WORD)) return;

			prompt = prompt.substring(5).trim();

			if (this.bIsTrainingIntents || this.state !== ELoadableState.ACTIVE) {
				source.reply('I am unavailable right now, please try again later.');
				return;
			}
		}

		const [confidence, intent] = await this.getIntent(prompt);
		console.log(confidence, intent);
		const skills = this.currentSkills.get(intent);
		if (!skills) {
			source.reply('I do not have any skills that can handle that right now.');
			return;
		}

		const skillsToStart = skills.filter((s) => {
			if (s.shouldExecute(intent, source, prompt)) {
				return true;
			}
			return false;
		});

		console.log(skillsToStart);

		const activationIds = await Promise.all(
			skillsToStart.map(
				(s) =>
					new Promise((res) => {
						s.dataExtractor(intent, prompt).then((params) => {
							s.execute(intent, source, prompt, params);
							res('');
						});
					})
			)
		);

		console.log(activationIds);
	}
}

export abstract class AssistantContext extends LoadableWithId {
	assistant: Assistant;

	constructor() {
		super();
		this.assistant = bus.assistant;
	}

	async getInput(prompt: number, timeout: number) {}

	async reply(data: string) {}
}

export class DefaultContext extends AssistantContext {
	override get id() {
		return 'base-io';
	}

	override async onLoad() {}

	override async reply(data: string): Promise<void> {
		this.assistant.tts.send(Buffer.from(data + '.'));
	}
}

export abstract class AssistantPlugin extends LoadableWithId {
	assistant: Assistant;

	constructor() {
		super();
		this.assistant = bus.assistant;
	}

	async getIntents(): Promise<IIntent[]> {
		return [];
	}

	async getSkills(): Promise<AssistantSkill[]> {
		return [];
	}
}
