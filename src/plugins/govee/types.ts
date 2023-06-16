export interface IGooveDeviceRaw {
	device: string;
	model: string;
	deviceName: string;
	controllable: boolean;
	retrievable: boolean;
	supportCmds: ('turn' | 'brightness' | 'color' | 'colorTem')[];
	properties: {
		colorTem?: {
			range: {
				min: number;
				max: number;
			};
		};
	};
}

export interface IGooveDevice {
	device: string;
	model: string;
	name: string;
	supportedCommands: ('turn' | 'brightness' | 'color' | 'colorTem')[];
	properties: {
		colorTem?: {
			range: {
				min: number;
				max: number;
			};
		};
	};
}

export type GooveApiResponse<T = any> = { data: T };

declare global {
	namespace NodeJS {
		// Alias for compatibility
		interface ProcessEnv extends Dict<string> {
			GOOVE_API_KEY: string;
		}
	}
}
