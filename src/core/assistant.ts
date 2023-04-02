import { ELoadableState, Loadable, LoadableWithId } from './base';
import { PLUGINS_PATH } from './paths';
import { PythonProcess } from './subprocess';
import { GoogleSearchResponse, IIntent } from './types';
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
	currentSkills: Map<string, AssistantSkill[]> = new Map();
	currentPlugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	bIsTrainingIntents: boolean = false;
	intents: { [key: string]: string[] } = {};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	bIsExpectingCommand: boolean = false;
	activeSkills: Map<string, SkillInstance> = new Map();

	static WAKE_WORD = 'alice';
	static SKILL_START_CONFIDENCE = 0.8;
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
		console.info('Waiting for tts process');

		console.info('Waiting for stt process');

		console.info('Waiting for nlu process');
		await this.nluProcess.waitForState(ELoadableState.ACTIVE);
		console.info('Training Intents');
		await this.trainIntents();
		console.info('Done Training Intents');

		console.info('assistant ready');
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
		console.info(phrase, dataRecieved);
		return [parseFloat(dataRecieved[0]), dataRecieved[1]];
	}

	async tryStartSkill(
		prompt: string,
		context: AssistantContext,
		bIsVerifiedPrompt: boolean = false
	) {
		prompt = prompt.trim();
		console.info('PROMPT', prompt);
		if (!bIsVerifiedPrompt) {
			if (
				prompt.toLowerCase() === Assistant.WAKE_WORD &&
				!this.bIsExpectingCommand
			) {
				this.bIsExpectingCommand = true;
				context.reply('Yes?');
				return [];
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

			//console.info(prompt, similarity);
			if (!prompt.toLowerCase().startsWith(Assistant.WAKE_WORD)) return [];

			prompt = prompt.substring(5).trim();

			if (this.bIsTrainingIntents || this.state !== ELoadableState.ACTIVE) {
				context.reply('I am unavailable right now, please try again later.');
				return [];
			}
		}

		const [confidence, intent] = await this.getIntent(prompt);
		if (confidence > Assistant.SKILL_START_CONFIDENCE) {
			const skills = this.currentSkills.get(intent);
			if (!skills) {
				context.reply(
					'I do not have any skills that can handle that right now.'
				);
				return [];
			}

			const skillsToStart = skills.filter((s) => {
				if (s.shouldExecute(intent, context, prompt)) {
					return true;
				}
				return false;
			});

			const activationIds = skillsToStart.map((s) => {
				const skillInstance = new SkillInstance(context, prompt, intent, s);

				skillInstance.run();

				return skillInstance.id;
			});

			if (activationIds.length > 0) {
				console.info('Activation Ids:', activationIds);
				return activationIds;
			}
		}

		try {
			const searchResponse = (
				await GoogleSearch.get<GoogleSearchResponse<string>>(
					`/search?${new URLSearchParams({
						s: prompt,
					}).toString()}`
				)
			).data;

			if (!searchResponse.error) {
				context.reply(searchResponse.result);
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
