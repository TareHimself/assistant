import { AssistantContext, AssistantPlugin } from '@core/assistant';
import { Client, WebRequest } from 'express-websocket-proxy';
import axios from 'axios';
import FormData from 'form-data';
export type TelegramChat = {
	id: number;
	title?: string;
	first_name?: string;
	type: string;
};

export type TelegramMessage = {
	message_id: number;
	from?: {
		id: number;
		is_bot: boolean;
		first_name: string;
		language_code: string;
	};
	sender_chat?: TelegramChat;
	chat: TelegramChat;
	date: number;
	text?: string;
	photo?: any[];
	has_protected_content?: boolean;
};
export interface ITelegramMessageInfo {
	update_id: number;
	message?: TelegramMessage & {
		from: {
			id: number;
			is_bot: boolean;
			first_name: string;
			language_code: string;
		};
	};
	channel_post?: TelegramMessage & { sender_chat: TelegramChat };
}

export interface ITelegramContextPayload {
	chat: TelegramChat;
	text?: string;
	userId: number;
}

function messageInfoToPayload(
	data: ITelegramMessageInfo
): ITelegramContextPayload | null {
	if (data.message) {
		return {
			chat: data.message.chat,
			text: data.message.text,
			userId: data.message.from.id,
		};
	}

	if (data.channel_post) {
		return {
			chat: data.channel_post.chat,
			text: data.channel_post.text,
			userId: data.channel_post.sender_chat.id,
		};
	}

	return null;
}

class TelegramContext extends AssistantContext {
	plugin: TelegramPlugin;
	data: ITelegramContextPayload;
	constructor(plugin: TelegramPlugin, data: ITelegramContextPayload) {
		super();
		this.plugin = plugin;
		this.data = data;
	}

	override get id(): string {
		return 'telegram-io';
	}

	override getInput(prompt: string, timeout?: number): Promise<string> {
		return new Promise<string>((res) => {
			const onMessageRecieved = (payload: ITelegramContextPayload) => {
				this.data = payload;
				res(payload.text || '');
			};

			this.plugin.pendingUserInputs[`${this.data.chat.id}${this.data.userId}`] =
				onMessageRecieved;

			this.reply(prompt);
		});
	}

	override async reply(data: string): Promise<boolean> {
		await axios.post(
			`https://api.telegram.org/bot${
				process.env.TELEGRAM_BOT_TOKEN
			}/sendMessage?chat_id=${this.data.chat.id}&text=${encodeURIComponent(
				data
			)}`
		);
		return true;
	}
	override async replyImage(data: Buffer): Promise<boolean> {
		const formData = new FormData();
		formData.append('photo', data, 'image.png');
		formData.append('chat_id', this.data.chat.id);
		await axios.post(
			`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
			formData,
			{
				headers: {
					'Content-Type': 'multipart/form-data',
					...formData.getHeaders(),
				},
			}
		);
		return true;
	}
}

export default class TelegramPlugin extends AssistantPlugin {
	proxy: Client = new Client('assistant', 'wss://proxy.oyintare.dev/', true);
	pendingUserInputs: {
		[key: string]: (message: ITelegramContextPayload) => void;
	} = {};
	override async onLoad(): Promise<void> {
		this.proxy.post('/telegram/webhook', (req) => {
			req.sendStatus(200);

			const telegramBody = req.body as ITelegramMessageInfo;

			const payload = messageInfoToPayload(telegramBody);

			if (payload) {
				if (this.pendingUserInputs[`${payload.chat.id}${payload.userId}`]) {
					this.pendingUserInputs[`${payload.chat.id}${payload.userId}`](
						payload
					);
					delete this.pendingUserInputs[`${payload.chat.id}${payload.userId}`];
					return;
				}

				this.assistant.tryStartSkill(
					payload.text || '',
					new TelegramContext(this, payload),
					payload.chat.type === 'private'
				);
			}
		});
		this.proxy.connect();
	}
}
