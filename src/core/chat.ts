import { ELoadableState, Loadable } from './base';
import { PythonProcess } from './subprocess';

class ActiveChat {
	history: string[][] = [];
	maxHistory: number;

	constructor(maxHistory = 6) {
		this.maxHistory = maxHistory;
	}

	add(id: string, chat: string) {
		if (this.history.push([id, chat.trim()]) > this.maxHistory) {
			this.history.shift();
		}
		return this;
	}

	toString() {
		return this.history
			.reduce((all, current) => {
				return `${all}\n${current[0]}: ${current[1]}`;
			}, '')
			.trim();
	}
}
export class ChatProcess extends Loadable {
	process = new PythonProcess('chat.py');
	chats: Map<string, ActiveChat> = new Map();

	override async onLoad(): Promise<void> {
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

		chat.add('You', phrase);

		console.log('Chat as string', chat.toString());
		const [_, packet] = await this.process.sendAndWait(
			Buffer.from(chat.toString()),
			0
		);

		const response = packet.toString();

		chat.add('Alice', response);

		return response;
	}
}
