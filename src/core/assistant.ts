import {
	AssistantObject,
	ELoadableState,
	Loadable,
	LoadableWithId,
} from './base';
import { DATA_PATH, PLUGINS_PATH } from './paths';
import { PythonProcess } from './subprocess';
import {
	Awaitable,
	IClassificationResult,
	IIntent,
	IParsedEntity,
	IPromptAnalysisResult,
} from './types';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { compareTwoStrings } from 'string-similarity';
import { app } from 'electron';
import { ChatProcess } from './chat';
import { IntentClassifier, SimpleIntentClassifier } from './classifiers';

/**
 * The base class for all assistant skills.
 */
export abstract class AssistantSkill extends Loadable {
	constructor() {
		super();
	}

	get intents(): IIntent[] {
		return [];
	}

	shouldExecute(instance: SkillInstance): boolean {
		return true;
	}

	async execute(instance: SkillInstance) {
		instance.context.reply('This skill has not yet been implemented.');
	}
}

/**
 * Represents a skill that is currently being executed
 */
export class SkillInstance extends AssistantObject {
	// the id of this instance
	id: string;
	// the context that this instance was created from
	context: AssistantContext;
	// the prompt that caused this skill to start
	prompt: string;
	// the intent that caused the activation of this skill
	intent: string;
	// the skill that was activated
	skill: AssistantSkill;

	entities: IParsedEntity[];

	constructor(
		context: AssistantContext,
		prompt: string,
		intent: string,
		entities: IParsedEntity[],
		skill: AssistantSkill
	) {
		super();
		this.id = uuidv4().replaceAll('-', '');
		this.context = context;
		this.prompt = prompt;
		this.intent = intent;
		this.entities = entities;
		this.skill = skill;
	}

	async run() {
		try {
			this.assistant.emit('onSkillActivate', this.id);
			this.assistant.activeSkills.set(this.id, this);
			await this.skill.execute(this);
		} catch (error: any) {
			this.context.reply(`There was an error [${error.message}]`);
			console.error(
				'Error while executing skill.',
				`Instance Id [${this.id}]\n`,
				error
			);
		}
		this.assistant.emit('onSkillDeactivate', this.id);
		this.assistant.activeSkills.delete(this.id);
	}
}

export interface IAssistantEvents {
	onReady: [assistant: Assistant];
	onSkillActivate: [instanceId: string];
	onSkillDeactivate: [instanceId: string];
	onPluginAdded: [pluginId: string];
	onPluginReloaded: [pluginId: string];
	onPluginRemoved: [pluginId: string];
	onExpectingCommandStart: [];
	onExpectingCommandStop: [];
}

/**
 * The assistant
 */
export class Assistant extends Loadable {
	on!: <T extends keyof IAssistantEvents>(
		eventName: T,
		listener: (...args: IAssistantEvents[T]) => Awaitable<void>
	) => this;

	once!: <T extends keyof IAssistantEvents>(
		eventName: T,
		listener: (...args: IAssistantEvents[T]) => Awaitable<void>
	) => this;

	off!: <T extends keyof IAssistantEvents>(
		eventName: T,
		listener: (...args: IAssistantEvents[T]) => Awaitable<void>
	) => this;

	emit!: <T extends keyof IAssistantEvents>(
		eventName: T,
		...args: IAssistantEvents[T]
	) => boolean;

	// classifier: IntentClassifier = new IntentClassifier(
	// 	path.join(this.dataPath, 'intents.pt')
	// );

	// chat: ChatProcess = new ChatProcess();

	currentSkills: Map<string, AssistantSkill[]> = new Map();
	plugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	intents: { [key: string]: IIntent } = {};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	expectingCommandTimer: ReturnType<typeof setTimeout> | null = null;
	activeSkills: Map<string, SkillInstance> = new Map();
	pluginQueue: [AssistantPlugin, (ref: AssistantPlugin) => void][] = [];
	bIsInChatMode: boolean = false;
	classifier: IntentClassifier = new SimpleIntentClassifier(
		path.join(this.dataPath, 'intents.pt')
	);

	get dataPath() {
		return path.join(DATA_PATH, 'core');
	}

	get bIsExpectingCommand() {
		return this.expectingCommandTimer !== null;
	}

	static WAKE_WORD = 'alice';
	static SKILL_START_CONFIDENCE = 0.5;
	static EXPECTING_COMMAND_TIMER = 1000 * 20;
	constructor() {
		super();
		this.waitForState(ELoadableState.ACTIVE).then(() => {
			this.emit('onReady', this);
		});
		console.info('Loading assistant');
		this.load().catch((error) => {
			console.error(error);
			process.exit();
		});
	}

	override async onLoad() {
		if (!fsSync.existsSync(this.dataPath)) {
			await fs.mkdir(this.dataPath, {
				recursive: true,
			});
		}

		console.info('Loading Electron App');
		if (!app.isReady()) {
			await new Promise<void>((res) => {
				app.once('ready', () => {
					res();
				});
			});
		}
		console.info('Loaded Electron App');
		// this.nluProcess.on('onProcessStdout', (b) =>
		// 	console.info(b.toString('ascii'))
		// );
		// this.nluProcess.on('onProcessError', (b) =>
		// 	console.info(b.toString('ascii'))
		// );

		console.info('Loading plugins');
		const plugins = await fs.readdir(PLUGINS_PATH);

		await Promise.all(
			plugins.map((plugin) =>
				(async () => {
					try {
						await this.usePlugin(
							new (require(path.join(
								PLUGINS_PATH,
								plugin,
								'index.js'
							)).default)() as AssistantPlugin
						);
					} catch (error) {
						console.error(error);
					}
				})()
			)
		);
		console.info('Plugins loaded');
		console.info('Loading Intent classifier');
		await this.classifier.load();
		console.info('Intent classifier loaded');
		console.info('Training Intent classifier');
		await this.classifier.train(Object.values(this.intents));
		console.info('Intent classifier trained');
		console.info(`Assistant Ready | ${this.currentSkills.size} Skills Loaded`);
	}

	getPlugin<T extends AssistantPlugin = AssistantPlugin>(plugin: string) {
		return this.plugins.get(plugin) as T | undefined;
	}

	addIntent(intent: IIntent) {
		// if (!this.intents[intent.tag]) {
		// 	this.intents[intent.tag] = [];
		// }

		// this.intents[intent.tag].push(...intent.examples);
		if (!this.intents[intent.tag]) {
			this.intents[intent.tag] = intent;
		} else {
			this.intents[intent.tag].examples.push(...intent.examples);
		}

		if (!this.currentSkills.has(intent.tag)) {
			this.currentSkills.set(intent.tag, []);
		}
	}

	async useSkill(skill: AssistantSkill) {
		console.info(`Loading skill ${skill.constructor.name}`);
		try {
			await skill.load();
			skill.intents.forEach((intent) => {
				this.addIntent(intent);

				this.currentSkills.get(intent.tag)?.push(skill);
			});
			console.info(`Loaded skill ${skill.constructor.name}`);
		} catch (error) {
			console.info(`Failed to load skill ${skill.constructor.name}`);
			console.error(error);
		}
	}

	async usePlugin(plugin: AssistantPlugin) {
		return new Promise<AssistantPlugin>((res, rej) => {
			if (this.pluginQueue.length) {
				this.pluginQueue.push([plugin, res]);
			} else {
				this.pluginQueue.push([plugin, res]);
				this.loadQueuedPlugins().catch(rej);
			}
		});
	}

	async loadQueuedPlugins() {
		const toLoad = this.pluginQueue.pop();
		if (!toLoad) {
			return;
		}

		const [plugin, callback] = toLoad;

		await plugin.load();
		const skills = await plugin.getSkills();
		(await plugin.getIntents()).forEach((i) => {
			this.addIntent(i);
		});

		await Promise.all(skills.map((skill) => this.useSkill(skill)));
		this.plugins.set(plugin.id, plugin);
		callback(plugin);
		this.emit('onPluginAdded', plugin.id);
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
		this.emit('onExpectingCommandStop');
	}

	startExpecting() {
		if (this.expectingCommandTimer) {
			this.stopExpecting();
		}

		this.expectingCommandTimer = setTimeout(() => {
			this.stopExpecting();
			console.info('Timed out waiting for command');
		}, Assistant.EXPECTING_COMMAND_TIMER);
		this.emit('onExpectingCommandStart');
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

		const intentResult = await this.classifier.classify(
			promptAnalysis.command,
			Object.values(this.intents)
		);

		if (!intentResult) {
			return;
		}

		const { intent, entities } = intentResult;

		const skills = this.currentSkills.get(intent);

		if (!skills) {
			context.reply('I do not have any skills that can handle that right now.');
			return [];
		}

		const activatedSkills: string[] = [];

		skills.forEach((s) => {
			const skillInstance = new SkillInstance(
				context,
				promptAnalysis.command,
				intent,
				entities,
				s
			);

			if (!s.shouldExecute(skillInstance)) {
				return;
			}

			skillInstance.run();

			activatedSkills.push(skillInstance.id);
		});

		if (activatedSkills.length === 0) {
			context.reply(`I dont have the brain cells to understand this`);
		}

		// console.log(promptAnalysis);

		// // const { confidence, intent } = (
		// // 	await this.classifier.classify(promptAnalysis.command)
		// // )[0];

		// const { confidence, intent } = { confidence: 0, intent: 'none' };
		// console.info(confidence, intent);

		// if (confidence > Assistant.SKILL_START_CONFIDENCE) {
		// 	if (intent === 'chat_mode_on' || intent === 'chat_mode_off') {
		// 		if (intent === 'chat_mode_on' && !this.bIsInChatMode) {
		// 			this.bIsInChatMode = true;
		// 			context.reply('Chat mode on.');
		// 			return;
		// 		} else if (this.bIsInChatMode) {
		// 			this.bIsInChatMode = false;
		// 			context.reply('Chat mode off.');
		// 			return;
		// 		}
		// 	}
		// }

		// if (!this.bIsInChatMode && confidence > Assistant.SKILL_START_CONFIDENCE) {
		// 	const skills = this.currentSkills.get(intent);

		// 	if (!skills) {
		// 		context.reply(
		// 			'I do not have any skills that can handle that right now.'
		// 		);
		// 		return [];
		// 	}

		// 	const skillsToStart = skills.filter((s) => {
		// 		if (s.shouldExecute(intent, context, promptAnalysis.command)) {
		// 			return true;
		// 		}
		// 		return false;
		// 	});

		// 	const activationIds = skillsToStart.map((s) => {
		// 		const skillInstance = new SkillInstance(
		// 			context,
		// 			promptAnalysis.command,
		// 			intent,
		// 			s
		// 		);

		// 		skillInstance.run();
		// 		this.emit('onSkillActivate', skillInstance.id);
		// 		return skillInstance.id;
		// 	});

		// 	if (activationIds.length > 0) {
		// 		console.info('Activation Ids:', activationIds);
		// 		return activationIds;
		// 	}
		// }

		// try {
		// 	const response = await this.chat.getResponse(
		// 		context.sessionId,
		// 		promptAnalysis.command
		// 	);
		// 	if (response.length) {
		// 		context.reply(response);
		// 		return [];
		// 	}
		// } catch (error) {
		// 	console.error(error);
		// }

		return activatedSkills;
	}
}

/**
 * Acts as a bridge between the assistant and IO, allows the assistant to recieve prompts from external sources and reply to said sources
 */
export abstract class AssistantContext extends LoadableWithId {
	// the id of this contexts session i.e. the user id combined with the context id to reference who this context is communicating with
	get sessionId() {
		return this.id + uuidv4();
	}

	constructor() {
		super();
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
	constructor() {
		super();
	}

	get dataPath() {
		return path.join(DATA_PATH, 'plugins', this.id);
	}

	override async load(): Promise<void> {
		if (!fsSync.existsSync(this.dataPath)) {
			await fs.mkdir(this.dataPath, {
				recursive: true,
			});
		}
		return await super.load();
	}
	async getIntents(): Promise<IIntent[]> {
		return [];
	}

	async getSkills(): Promise<AssistantSkill[]> {
		return [];
	}
}
