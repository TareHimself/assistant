import { ELoadableState, Loadable } from './base';
import { PythonProcess } from './subprocess';

type ChatEntry = {
	role: string;
	content: string;
};

class ActiveChat {
	history: ChatEntry[] = [];
	maxHistory: number;

	constructor(maxHistory = 6) {
		this.maxHistory = maxHistory;
	}

	add(id: string, chat: string) {
		if (
			this.history.push({
				role: id,
				content: chat.trim(),
			}) > this.maxHistory
		) {
			this.history.shift();
		}
		return this;
	}

	encode() {
		console.log(
			Math.max(0, this.history.length - 3),
			this.history.length - 1,
			this.history.slice(
				Math.max(0, this.history.length - 3),
				this.history.length
			)
		);
		return (
			this.history
				.slice(Math.max(0, this.history.length - 2), this.history.length)
				.reduce((total, cur) => {
					return total + `${cur.role}: ${cur.content}\n`;
				}, '') + `ASSISTANT: `
		);
	}
}
export class ChatProcess extends Loadable {
	process = new PythonProcess('chat.py');
	chats: Map<string, ActiveChat> = new Map();

	override async beginLoad(): Promise<void> {
		await this.process.waitForState(ELoadableState.ACTIVE);
	}

	getActiveChat(id: string) {
		if (!this.chats.has(id)) {
			const newChat = new ActiveChat();
			this.chats.set(id, newChat);
			return newChat;
		}

		return this.chats.get(id)!;
	}

	async getResponse(id: string, phrase: string): Promise<string> {
		const chat = this.getActiveChat(id);

		chat.add('USER', phrase);

		const [_, packet] = await this.process.sendAndWait(
			Buffer.from(chat.encode()),
			0
		);

		const response = packet.toString().trim();
		console.info(response);

		chat.add('ASSISTANT', response);

		return response;
	}
}
