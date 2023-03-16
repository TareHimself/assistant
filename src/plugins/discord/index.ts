import { AssistantContext, AssistantPlugin } from '@core/assistant';
import { DiscordMessage, DiscordMessageReply, GatewayIntent } from './types';
import { Gateway } from './ws';

export interface IDiscordMessageInfo {
	message: DiscordMessage;
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

	override async getInput(prompt: number, timeout: number): Promise<void> {}

	override async reply(data: string): Promise<void> {
		this.plugin.discordClient.api.post<any, any, DiscordMessageReply>(
			`/channels/${this.data.message.channel_id}/messages`,
			{
				content: data,
				message_reference: {
					message_id: this.data.message.id,
					channel_id: this.data.message.channel_id,
				},
			}
		);
	}
}

export default class DiscordPlugin extends AssistantPlugin {
	discordClient: Gateway = new Gateway(process.env.DISCORD_BOT_TOKEN, [
		GatewayIntent.DIRECT_MESSAGES,
		GatewayIntent.MESSAGE_CONTENT,
		GatewayIntent.GUILD_MESSAGES,
		GatewayIntent.GUILD_VOICE_STATES,
	]);

	constructor() {
		super();
	}

	override async onLoad(): Promise<void> {
		this.discordClient.onDispatchEvent('MESSAGE_CREATE', (message) => {
			if (message.author.id === this.discordClient.readyData?.user.id) {
				return;
			}
			this.assistant.tryStartSkill(
				message.content,
				new DiscordContext(this, {
					message: message,
				}),
				message.guild_id === undefined
			);
		});
	}

	override get id(): string {
		return 'discord-plugin';
	}
}
