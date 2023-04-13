export type BoundEventCallback = (...args: any[]) => Awaitable<any>;

export interface BoundEventTarget {
	on: (event: string, callback: BoundEventCallback) => any | Promise<any>;
	off: (event: string, callback: BoundEventCallback) => any | Promise<any>;
}

export type BoundEvent<T extends BoundEventTarget = any> = {
	target: T;
	event: string;
	callback: BoundEventCallback;
};

export type Awaitable<T> = T | Promise<T>;

export interface IIntent {
	tag: string;
	examples: string[];
}

export type GoogleSearchResponse<T> = {
	result: T;
	error: boolean;
};

export interface IPromptAnalysisResult {
	similarity: number;
	fullPrompt: string;
	command: string;
}

declare global {
	namespace NodeJS {
		// Alias for compatibility
		interface ProcessEnv extends Dict<string> {
			DISCORD_BOT_TOKEN: string;
			PYTHON_EXECUTABLE_PATH: string;
			TELEGRAM_BOT_TOKEN: string;
			TENOR_KEY: string;
			SPOTIFY_CLIENT_ID: string;
			SPOTIFY_CLIENT_SECRETE: string;
		}
	}

	interface Array<T> {
		random(): T;
	}
}
