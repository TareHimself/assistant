import { ELoadableState, Loadable, LoadableWithId } from './base';
import { PLUGINS_PATH } from './paths';
import { PythonProcess } from './subprocess';
import { GoogleSearchResponse, IIntent, IPromptAnalysisResult } from './types';
import * as fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { compareTwoStrings } from 'string-similarity';
import { GoogleSearch } from './api';

/**
 * The base class for all assistant skills.
 */
export abstract class AssistantSkill<T extends any = any> extends Loadable {
	constructor() {
		super();
	}

	get intents(): IIntent[] {
		return [];
	}

	async dataExtractor(instance: SkillInstance): Promise<T> {
		throw new Error('Data extractor not implemented');
	}

	shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return true;
	}

	async execute(instance: SkillInstance, data: T) {
		instance.context.reply('This skill has not yet been implemented.');
	}
}

/**
 * Represents a skill that is currently being executed
 */
export class SkillInstance {
	// the id of this instance
	id: string;
	// the context that this instance was created from
	context: AssistantContext;
	// the prompt that caused this skill to start
	prompt: string;
	// the intent that caused the activation of this skill
	intent: string;
	// the skill that was activated
	skill: AssistantSkill<any>;

	constructor(
		context: AssistantContext,
		prompt: string,
		intent: string,
		skill: AssistantSkill<any>
	) {
		this.id = uuidv4().replaceAll('-', '');
		this.context = context;
		this.prompt = prompt;
		this.intent = intent;
		this.skill = skill;
	}

	async run() {
		bus.assistant.activeSkills.set(this.id, this);
		try {
			const data = await this.skill.dataExtractor(this);
			await this.skill.execute(this, data);
		} catch (error) {
			this.context.reply(`There was an error [${error.message}]`);
			console.error(error);
		}

		bus.assistant.activeSkills.delete(this.id);
	}
}

/**
 * The assistant
 */
export class Assistant extends Loadable {
	nluProcess: PythonProcess = new PythonProcess('intents.py');
	chatProcess: PythonProcess = new PythonProcess('chat.py');
	currentSkills: Map<string, AssistantSkill[]> = new Map();
	currentPlugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	intents: { [key: string]: string[] } = {};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	expectingCommandTimer: ReturnType<typeof setTimeout> | null = null;
	activeSkills: Map<string, SkillInstance> = new Map();

	get bIsExpectingCommand() {
		return this.expectingCommandTimer !== null;
	}

	static WAKE_WORD = 'alice';
	static SKILL_START_CONFIDENCE = 0.5;
	static EXPECTING_COMMAND_TIMER = 1000 * 20;
	constructor() {
		super();
		console.info('Loading assistant');
		this.load();
	}

	override async onLoad() {
		this.nluProcess.on('onProcessStdout', (b) =>
			console.info(b.toString('ascii'))
		);
		this.nluProcess.on('onProcessError', (b) =>
			console.info(b.toString('ascii'))
		);
		console.info('Loading plugins');
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
		console.info('Plugins loaded');
		await this.nluProcess.waitForState(ELoadableState.ACTIVE);
		console.info('nlu process ready');
		await this.chatProcess.waitForState(ELoadableState.ACTIVE);
		console.info('chat process ready');

		console.info('Training Intents');
		await this.trainIntents();
		console.info('Done Training Intents');

		console.info('assistant ready');
	}

	async trainIntents() {
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
	}

	getPlugin(plugin: string) {
		return this.currentPlugins.get(plugin);
	}

	addIntent(intent: IIntent) {
		if (!this.intents[intent.tag]) {
			this.intents[intent.tag] = [];
		}

		this.intents[intent.tag].push(...intent.examples);

		if (!this.currentSkills.has(intent.tag)) {
			this.currentSkills.set(intent.tag, []);
		}
	}

	async useSkill(skill: AssistantSkill) {
		console.info(`Loading skill ${skill.constructor.name}`);
		await skill.load();
		skill.intents.forEach((intent) => {
			this.addIntent(intent);

			this.currentSkills.get(intent.tag)?.push(skill);
		});
		console.info(`Loaded skill ${skill.constructor.name}`);
	}

	async usePlugin(plugin: AssistantPlugin) {
		await plugin.load();
		const skills = await plugin.getSkills();
		(await plugin.getIntents()).forEach((i) => {
			this.addIntent(i);
		});

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

	async getChat(phrase: string): Promise<string> {
		const [_, packet] = await this.chatProcess.sendAndWait(
			Buffer.from(phrase),
			0
		);

		return packet.toString();
	}

	async analyzePrompt(
		prompt: string,
		bIsVerifiedPrompt: boolean
	): Promise<IPromptAnalysisResult> {
		prompt = prompt.trim();

		if (bIsVerifiedPrompt || this.bIsExpectingCommand) {
			return {
				similarity: 1,
				fullPrompt: prompt,
				command: prompt,
			};
		}

		const wakeWordLength = Assistant.WAKE_WORD.split(' ').length;
		const splitPrompt = prompt.split(' ');
		const triggerWordsInPrompt = splitPrompt.slice(0, wakeWordLength);
		const command = splitPrompt.slice(wakeWordLength).join(' ').trim();

		return {
			similarity: compareTwoStrings(
				Assistant.WAKE_WORD.toLowerCase(),
				triggerWordsInPrompt.join(' ').toLowerCase()
			),
			fullPrompt: prompt,
			command: command,
		};
	}

	stopExpecting() {
		if (this.expectingCommandTimer !== null) {
			clearTimeout(this.expectingCommandTimer);
			this.expectingCommandTimer = null;
		}
	}

	startExpecting() {
		if (this.expectingCommandTimer) {
			this.stopExpecting();
		}

		this.expectingCommandTimer = setTimeout(() => {
			this.stopExpecting();
			console.info('Timed out waiting for command');
		}, Assistant.EXPECTING_COMMAND_TIMER);
	}

	async tryStartSkill(
		prompt: string,
		context: AssistantContext,
		bIsVerifiedPrompt: boolean = false
	) {
		const promptAnalysis = await this.analyzePrompt(prompt, bIsVerifiedPrompt);

		if (promptAnalysis.similarity < 0.8) {
			return [];
		}

		this.stopExpecting();

		if (promptAnalysis.command === '') {
			this.startExpecting();
			context.reply('Yes.');
			return [];
		}

		if (this.state !== ELoadableState.ACTIVE) {
			await context.reply('I cannot respond to requests yet');
			return [];
		}

		console.log(promptAnalysis);

		const [confidence, intent] = await this.getIntent(promptAnalysis.command);

		console.info(confidence, intent);
		if (confidence > Assistant.SKILL_START_CONFIDENCE) {
			const skills = this.currentSkills.get(intent);

			if (!skills) {
				context.reply(
					'I do not have any skills that can handle that right now.'
				);
				return [];
			}

			const skillsToStart = skills.filter((s) => {
				if (s.shouldExecute(intent, context, promptAnalysis.command)) {
					return true;
				}
				return false;
			});

			const activationIds = skillsToStart.map((s) => {
				const skillInstance = new SkillInstance(
					context,
					promptAnalysis.command,
					intent,
					s
				);

				skillInstance.run();

				return skillInstance.id;
			});

			if (activationIds.length > 0) {
				console.info('Activation Ids:', activationIds);
				return activationIds;
			}
		}

		try {
			const response = await this.getChat(promptAnalysis.command);
			// const searchResponse = (
			// 	await GoogleSearch.get<GoogleSearchResponse<string>>(
			// 		`/search?${new URLSearchParams({
			// 			s: promptAnalysis.command,
			// 		}).toString()}`
			// 	)
			// ).data;

			// if (!searchResponse.error) {
			// 	context.reply(searchResponse.result);
			// 	return [];
			// }

			if (response.length) {
				context.reply(response);
				return [];
			}
		} catch (error) {
			console.error(error);
		}

		context.reply(`I dont have the brain cells to understand this`);

		return [];
	}
}

/**
 * Acts as a bridge between the assistant and IO, allows the assistant to recieve prompts from external sources and reply to said sources
 */
export abstract class AssistantContext extends LoadableWithId {
	assistant: Assistant;

	// the id of this contexts session i.e. the user id combined with the context id to reference who this context is communicating with
	get sessionId() {
		return this.id + uuidv4();
	}

	constructor() {
		super();
		this.assistant = bus.assistant;
	}

	async getInput(
		prompt: string,
		timeout?: number
	): Promise<string | undefined> {
		return undefined;
	}

	async reply(data: string): Promise<boolean> {
		return false;
	}

	async replyImage(data: Buffer): Promise<boolean> {
		return false;
	}
}

// The base class for plugins which can be anything that needs to register skills or intents
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
