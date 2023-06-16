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
