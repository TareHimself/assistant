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

export interface IIntentEntity {
	tag: string;
	description: string;
	extractor: (prompt: string) => string;
}

export interface IParsedEntity {
	entity: string;
	data: string;
}
export interface IIntent {
	tag: string;
	description: string;
	entities: IIntentEntity[];
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

export interface IClassificationResult {
	confidence: number;
	intent: string;
}

export interface ICgasApiResponse {
	url: string;
	thumb_url: string | null;
	deletion_url?: string;
}

export interface IOpenAiInferenceResult {
	id: string;
	object: string;
	created: number;
	model: string;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	choices: {
		message: {
			role: string;
			content: string;
		};
		finish_reason: 'stop';
		index: number;
	}[];
}

export interface IIntentInferenceResult {
	intent: string;
	entities: IParsedEntity[];
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
			CGAS_API_KEY: string;
			OPEN_AI_KEY: string;
		}
	}

	interface Array<T> {
		random(): T;
	}
}

declare global {
	interface ObjectConstructor {
		//...
		keys<T extends object>(o: T): (keyof T)[];
	}
}
