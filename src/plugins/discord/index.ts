import { AssistantContext, AssistantPlugin } from '@core/assistant';
import {
	Client,
	Events,
	Partials,
	GatewayIntentBits,
	Message,
} from 'discord.js';

export interface IDiscordMessageInfo {
	message: Message;
}

class DiscordContext extends AssistantContext {
	plugin: DiscordPlugin;
	data: IDiscordMessageInfo;
	constructor(plugin: DiscordPlugin, data: IDiscordMessageInfo) {
		super();
		this.plugin = plugin;
		this.data = data;
	}

	override get id(): string {
		return 'discord-io';
	}

	override getInput(prompt: string, timeout?: number): Promise<string> {
		return new Promise<string>((res) => {
			const onMessageRecieved = (message: Message) => {
				this.data.message = message;
				res(message.content);
			};

			this.plugin.pendingUserInputs[
				this.data.message.channelId + this.data.message.author.id
			] = onMessageRecieved;

			this.reply(prompt);
		});
	}

	override async reply(data: string): Promise<boolean> {
		this.data.message.reply({
			content: data,
		});
		return true;
	}

	override async replyImage(data: Buffer): Promise<boolean> {
		await this.data.message.reply({
			files: [
				{
					attachment: data,
					name: 'image.png',
				},
			],
		});
		return true;
	}
}

export default class DiscordPlugin extends AssistantPlugin {
	client = new Client({
		intents: [
			GatewayIntentBits.DirectMessages,
			GatewayIntentBits.MessageContent,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.GuildVoiceStates,
		],
		partials: [Partials.Message, Partials.Channel],
	});

	pendingUserInputs: { [key: string]: (message: Message) => void } = {};

	constructor() {
		super();
	}

	override async onLoad(): Promise<void> {
		this.client.on(Events.MessageCreate, (message) => {
			if (message.author.id === this.client.user?.id) {
				return;
			}

			if (this.pendingUserInputs[message.channelId + message.author.id]) {
				this.pendingUserInputs[message.channelId + message.author.id](message);
				delete this.pendingUserInputs[message.channelId + message.author.id];
				return;
			}

			this.assistant.tryStartSkill(
				message.content,
				new DiscordContext(this, {
					message: message,
				}),
				message.guildId === null
			);
		});

		await new Promise<void>((res, rej) => {
			this.client.once(Events.ClientReady, (c) => {
				console.log(`Ready! Logged in as ${c.user.tag}`);
				res();
			});

			try {
				this.client.login(process.env.DISCORD_BOT_TOKEN);
			} catch (error) {
				rej(error);
			}
		});
	}

	override get id(): string {
		return 'discord-plugin';
	}
}
