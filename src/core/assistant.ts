import { ELoadableState, Loadable, LoadableWithId } from './base';
import { DATA_PATH, PLUGINS_PATH } from './paths';
import { PythonProcess } from './subprocess';
import { IClassificationResult, IIntent, IPromptAnalysisResult } from './types';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { compareTwoStrings } from 'string-similarity';
import { app } from 'electron';
import { ChatProcess } from './chat';

/**
 * The base class for all assistant skills.
 */
export abstract class AssistantSkill<T = unknown> extends Loadable {
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

	get assistant() {
		return bus.assistant;
	}

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
		this.assistant.activeSkills.set(this.id, this);
		try {
			const data = await this.skill.dataExtractor(this);
			await this.skill.execute(this, data);
		} catch (error: any) {
			this.context.reply(`There was an error [${error.message}]`);
			console.error(error);
		}

		this.assistant.activeSkills.delete(this.id);
	}
}

export class IntentClassifier extends Loadable {
	process = new PythonProcess('intents.py');
	savePath: string;
	constructor(savePath: string) {
		super();
		this.savePath = savePath;
	}

	override async onLoad(): Promise<void> {
		await this.process.waitForState(ELoadableState.ACTIVE);
	}

	async train(intents: IIntent[]) {
		await this.process.sendAndWait(
			Buffer.from(
				JSON.stringify({
					tags: intents,
					model: this.savePath,
				})
			),
			2
		);
	}

	async classify(text: string): Promise<IClassificationResult[]> {
		const [_, nluPacket] = await this.process.sendAndWait(Buffer.from(text), 1);
		const dataRecieved = JSON.parse(nluPacket.toString());
		console.log(dataRecieved);
		return dataRecieved;
	}
}
/**
 * The assistant
 */
export class Assistant extends Loadable {
	classifier: IntentClassifier = new IntentClassifier(
		path.join(this.dataPath, 'intents.pt')
	);

	chat: ChatProcess = new ChatProcess();

	currentSkills: Map<string, AssistantSkill[]> = new Map();
	plugins: Map<string, AssistantPlugin> = new Map();
	bIsDoingSkill: boolean = false;
	intents: { [key: string]: string[] } = {
		chat_mode_on: [
			'switch to chat mode',
			'chat mode on',
			'lets have a chat',
			'chat on',
		],
		chat_mode_off: ['chat mode off', 'turn off chat mode', 'chat off'],
	};
	trainTimer: ReturnType<typeof setTimeout> | null = null;
	expectingCommandTimer: ReturnType<typeof setTimeout> | null = null;
	activeSkills: Map<string, SkillInstance> = new Map();
	pluginQueue: [AssistantPlugin, (ref: AssistantPlugin) => void][] = [];
	bIsInChatMode: boolean = false;

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
		console.info('Loading assistant');
		this.load();
	}

	override async onLoadError(error: Error): Promise<void> {
		console.error(error);
		process.exit();
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
		console.info('Loading Intent classifier');
		await this.classifier.load();
		console.info('Intent classifier loaded');
		console.info('Loading chat process');
		await this.chat.load();
		console.info('Chat process loaded');

		console.info('Training Intents');

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

		await this.classifier.train(intentsToTrain);

		console.info('Done Training Intents');

		console.info('assistant ready');
	}

	getPlugin<T extends AssistantPlugin = AssistantPlugin>(plugin: string) {
		return this.plugins.get(plugin) as T | undefined;
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

		const { confidence, intent } = (
			await this.classifier.classify(promptAnalysis.command)
		)[0];

		console.info(confidence, intent);

		if (confidence > Assistant.SKILL_START_CONFIDENCE) {
			if (intent === 'chat_mode_on' || intent === 'chat_mode_off') {
				if (intent === 'chat_mode_on' && !this.bIsInChatMode) {
					this.bIsInChatMode = true;
					context.reply('Chat mode on.');
					return;
				} else if (this.bIsInChatMode) {
					this.bIsInChatMode = false;
					context.reply('Chat mode off.');
					return;
				}
			}
		}

		if (!this.bIsInChatMode && confidence > Assistant.SKILL_START_CONFIDENCE) {
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
		}

		context.reply(`I dont have the brain cells to understand this`);

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
