import { Assistant } from './assistant';

export interface bus {
	assistant: Assistant;
}

declare global {
	var bus: bus;
}

export {};
