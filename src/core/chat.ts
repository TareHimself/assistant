import { ELoadableState, Loadable } from './base';
import { PythonProcess } from './subprocess';

type ChatEntry = {
	role: string;
	content: string;
};

class ActiveChat {
	history: ChatEntry[] = [];
	maxHistory: number;

	constructor(maxHistory = 4) {
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
		return (
			// 'Instruction: You are a virtual assistant named Alice. Generate one response for ASSISTANT. You must respond in a reasonable manner\n' +

			"A chat between a user and an Ai Assistant\n" + this.history.reduce((total, cur) => {
				return total + `${cur.role}: ${cur.content}\n`;
			}, '') +
			`ASSISTANT: `
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
		// console.log(id, phrase, this.chats);
		const [_, packet] = await this.process.sendAndWait(
			Buffer.from(chat.encode()),
			0
		);

		const response = packet.toString().trim();

		chat.add('ASSISTANT', response);

		return response;
	}
}
