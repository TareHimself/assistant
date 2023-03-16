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

declare global {
	namespace NodeJS {
		// Alias for compatibility
		interface ProcessEnv extends Dict<string> {
			/**
			 * Can be used to change the default timezone at runtime
			 */
			DISCORD_BOT_TOKEN: string;
			PYTHON_EXECUTABLE_PATH: string;
			TELEGRAM_BOT_TOKEN: string;
		}
	}
}
