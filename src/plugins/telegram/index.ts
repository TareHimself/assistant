import { AssistantContext, AssistantPlugin } from '@core/assistant';
import { Client, WebRequest } from 'express-websocket-proxy';
import axios from 'axios';

export interface ITelegramMessageInfo {
	update_id: number;
	message: {
		message_id: number;
		from: {
			id: number;
			is_bot: boolean;
			first_name: string;
			language_code: string;
		};
		chat: {
			id: number;
			first_name: string;
			type: string;
		};
		date: number;
		text?: string;
		photo?: any[];
	};
}
class TelegramContext extends AssistantContext {
	plugin: TelegramPlugin;
	telegramInfo: ITelegramMessageInfo;
	constructor(plugin: TelegramPlugin, data: ITelegramMessageInfo) {
		super();
		this.plugin = plugin;
		this.telegramInfo = data;
	}

	override get id(): string {
		return 'telegram-io';
	}

	override async getInput(prompt: number, timeout: number): Promise<void> {}

	override async reply(data: string): Promise<void> {
		await axios.post(
			`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${this.telegramInfo.message.chat.id}&text=${data}`
		);
	}
}

export default class TelegramPlugin extends AssistantPlugin {
	proxy: Client = new Client('assistant', 'wss://proxy.oyintare.dev/', true);

	override async onLoad(): Promise<void> {
		this.proxy.post('/telegram/webhook', (req) => {
			req.sendStatus(200);
			const telegramBody = req.body as ITelegramMessageInfo;

			this.assistant.tryStartSkill(
				telegramBody.message.text || '',
				new TelegramContext(this, req.body),
				telegramBody.message.chat.type === 'private'
			);
		});
		this.proxy.connect();
	}
}
