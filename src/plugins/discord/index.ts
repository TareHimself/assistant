import {
	Assistant,
	AssistantContext,
	AssistantPlugin,
	IntentClassifier,
} from '@core/assistant';
import { getInfo } from 'ytdl-core';
import { Client, Message } from 'discord.js-selfbot-v13';
import {
	NoSubscriberBehavior,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
} from '@discordjs/voice';
import { compareTwoStrings } from 'string-similarity';
import play from 'play-dl';
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

	override get sessionId(): string {
		return (
			this.id +
			(this.data.message.guild === null
				? this.data.message.author.id
				: `${this.data.message.guildId}-${this.data.message.channelId}-${this.data.message.author.id}`)
		);
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
	client = new Client({});
	pendingUserInputs: { [key: string]: (message: Message) => void } = {};
	constructor() {
		super();
	}

	async tryClassify(prompt: string) {}

	override async onLoad(): Promise<void> {
		// const { DiscordStreamClient } = await eval(
		// 	`import('discord-stream-client')`
		// );

		this.client.on('messageCreate', async (message) => {
			if (message.author.id === this.client.user?.id) {
				return;
			}

			if (this.pendingUserInputs[message.channelId + message.author.id]) {
				this.pendingUserInputs[message.channelId + message.author.id](message);
				delete this.pendingUserInputs[message.channelId + message.author.id];
				return;
			}

			// const voiceChannel = message.member?.voice.channel;
			// if (
			// 	compareTwoStrings(message.content.toLowerCase(), 'join call') > 0.6 &&
			// 	voiceChannel
			// ) {
			// 	const connection = joinVoiceChannel({
			// 		channelId: voiceChannel.id,
			// 		guildId: voiceChannel.guildId,
			// 		selfDeaf: false,
			// 		selfMute: false,
			// 		adapterCreator: message.member.guild.voiceAdapterCreator,
			// 		debug: true,
			// 	});

			// 	const streamUrl = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';

			// 	const stream = await play.stream(streamUrl);

			// 	const resource = createAudioResource(stream.stream, {
			// 		inputType: stream.type,
			// 	});

			// 	const player = createAudioPlayer({
			// 		behaviors: {
			// 			noSubscriber: NoSubscriberBehavior.Play,
			// 		},
			// 	});

			// 	player.play(resource);

			// 	connection.subscribe(player);

			// 	return;
			// }

			const isVerified =
				message.guildId === null ||
				(message.reference !== null
					? (await message.fetchReference()).author.id === this.client.user?.id
					: false);

			this.assistant.tryStartSkill(
				message.content,
				new DiscordContext(this, {
					message: message,
				}),
				isVerified
			);
		});

		await new Promise<void>((res, rej) => {
			this.client.once('ready', (c) => {
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
