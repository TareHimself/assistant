import {
	AssistantObject,
	ELoadableState,
	Loadable,
	LoadableWithId,
	SkillExecutionError,
} from './base';
import { DATA_PATH, PLUGINS_PATH } from './paths';
import {
	Awaitable,
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
export abstract class AssistantSkill<
	P extends AssistantPlugin = AssistantPlugin
> extends Loadable {
	plugin!: P;
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
			if (error instanceof SkillExecutionError) {
				this.context.reply(error.message);
			} else {
				this.context.reply(`There was an error [${error.message}]`);
			}
			console.error(
				`Error while executing skill with instance ID  [${this.id}]\n`,
				error
			);
		}
		this.assistant.emit('onSkillDeactivate', this.id);
		this.assistant.activeSkills.delete(this.id);
	}
}

export interface IAssistantEvents {
	onReady: [assistant: Assistant];
	onSkillAdded: [skill: AssistantSkill];
	onSkillActivate: [instanceId: string];
	onSkillDeactivate: [instanceId: string];
	onPluginAdded: [plugin: AssistantPlugin];
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

	get dataPath() {
		return path.join(DATA_PATH, 'core');
	}

	get bIsExpectingCommand() {
		return this.expectingCommandTimer !== null;
	}

	currentSkills: Map<string, AssistantSkill[]> = new Map();
	plugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	intents: { [key: string]: IIntent } = {};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	expectingCommandTimer: ReturnType<typeof setTimeout> | null = null;
	activeSkills: Map<string, SkillInstance> = new Map();
	pluginQueue: [AssistantPlugin, (ref: AssistantPlugin) => void][] = [];
	bIsInChatMode: boolean = false;
	skillClassifier: IntentClassifier = new SimpleIntentClassifier(
		this.dataPath,
		Assistant.SKILL_START_CONFIDENCE
	);
	chat = new ChatProcess();

	static WAKE_WORD = 'alice';
	static SKILL_START_CONFIDENCE = 0.6;
	static EXPECTING_COMMAND_TIMER = 1000 * 20;
	constructor() {
		super();
		this.waitForState(ELoadableState.ACTIVE).then(() => {
			this.emit('onReady', this);
		});
		console.info('Loading assistant');
		this.load()
			.catch((error) => {
				console.error(error);
				process.exit();
			})
			.then(() => this.emit('onReady', this));
	}

	override async beginLoad() {
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
		await this.skillClassifier.load();
		console.info('Intent classifier loaded');
		console.info('Training Intent classifier');
		await this.skillClassifier.train(Object.values(this.intents));
		console.info('Intent classifier trained');
		console.info('Loading chat process');
		await this.chat.load();
		console.info('Chat process loaded');
		console.info(`Assistant Ready | ${this.currentSkills.size} Skills Loaded`);
	}

	makeWakeWordIntents(intents: IIntent[]) {
		const wakeWordIntentPositive: IIntent = {
			tag: 'respond',
			description: 'The assistant should respond to this phrase',
			entities: [],
			examples: [Assistant.WAKE_WORD],
		};

		const wakeWordIntentNegative: IIntent = {
			tag: 'ignore',
			description: 'the assistant should ignore this phrase',
			entities: [],
			examples: [],
		};

		intents.forEach((i) => {
			wakeWordIntentPositive.examples.push(
				...i.examples.map(
					(a) =>
						`[${Assistant.WAKE_WORD[0].toUpperCase()}|${Assistant.WAKE_WORD[0].toLowerCase()}]${Assistant.WAKE_WORD.slice(
							1
						)} ${a}`
				)
			);
			wakeWordIntentNegative.examples.push(...i.examples);
		});

		return [wakeWordIntentNegative, wakeWordIntentPositive];
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
			this.emit('onSkillAdded', skill);
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

		await this.loadPlugin(plugin);
		callback(plugin);
		this.emit('onPluginAdded', plugin);
	}

	async loadPlugin(plugin: AssistantPlugin) {
		await plugin.load();

		const skills = await plugin.getSkillPaths().then((skillPaths) =>
			skillPaths.map((a) => {
				const skill = new (require(a).default)() as AssistantSkill;
				skill.plugin = plugin;
				return skill;
			})
		);

		if (skills.length)
			await Promise.all(skills.map((skill) => this.useSkill(skill)));

		this.plugins.set(plugin.id, plugin);
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
				command: (prompt.toLowerCase().trim().startsWith(Assistant.WAKE_WORD)
					? prompt.trim().slice(Assistant.WAKE_WORD.length)
					: prompt
				).trim(),
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
		if (promptAnalysis.similarity > 0.8) {
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

			const intentResult = await this.skillClassifier.classify(
				promptAnalysis.command,
				Object.values(this.intents)
			);

			if (!intentResult) {
				return;
			}

			const { intent, entities } = intentResult;

			const skills = this.currentSkills.get(intent) ?? [];

			const activatedSkills: string[] = [];

			skills.filter((s) => {
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

			if (activatedSkills.length > 0) {
				return activatedSkills;
			} else {
				try {
					console.log('Generating chat response for', promptAnalysis);

					const response = await this.chat.getResponse(
						context.sessionId,
						promptAnalysis.command
					);

					if (response.length) {
						context.reply(response);
						return [];
					}
				} catch (error) {
					console.error(error);
					// 	context.reply('I do not have any skills that can handle that right now.');
					// 	return [];
					//context.reply(`I dont have the brain cells to understand this`);
				}
			}
		}

		return [];
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

	async replyImage(data: Buffer | string): Promise<boolean> {
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

	get dirname(): string {
		throw new Error('Plugin dir name not given ' + this.id);
	}

	get skillsDir() {
		return path.join(this.dirname, 'skills');
	}

	override async load(): Promise<void> {
		if (!fsSync.existsSync(this.dataPath)) {
			await fs.mkdir(this.dataPath, {
				recursive: true,
			});
		}
		return await super.load();
	}

	async getSkillPaths(): Promise<string[]> {
		if (!fsSync.existsSync(path.join(this.dirname, 'skills'))) {
			return [];
		}

		return await fs
			.readdir(this.skillsDir)
			.then((a) =>
				a
					.filter((b) => b.endsWith('.skill.js'))
					.map((b) => path.join(this.skillsDir, b))
			);
	}
}
