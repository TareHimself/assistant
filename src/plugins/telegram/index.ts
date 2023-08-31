import { AssistantContext, AssistantPlugin } from '@core/assistant';
import { Client, WebRequest } from 'express-websocket-proxy';
import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { CgasApi } from '@core/singletons';
import { ITelegramMessageInfo, ITelegramContextPayload } from './types';

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

	override get sessionId() {
		return this.id + `-${this.data.chat.id}${this.data.userId}`;
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
	override async replyImage(data: Buffer | string): Promise<boolean> {
		let data_uri = data;

		if (typeof data_uri !== 'string') {
			const upload = (await CgasApi.get().upload(uuidv4() + '.png', data_uri))
				?.url;
			if (upload === undefined) {
				return false;
			}

			data_uri = upload;
		}

		return await this.reply(data_uri);
	}
}

export default class TelegramPlugin extends AssistantPlugin {
	override get id(): string {
		return 'telegram-plugin';
	}
	proxy: Client = new Client('assistant', 'wss://proxy.oyintare.dev/', false);
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

	override get dirname() {
		return __dirname;
	}
}
