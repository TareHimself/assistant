import { AssistantPlugin } from '@core/assistant';
import axios from 'axios';
import { GooveApiResponse, IGooveDevice, IGooveDeviceRaw } from './types';

export default class GoveePlugin extends AssistantPlugin {
	devices: Map<string, IGooveDevice> = new Map();
	rest = axios.create({
		baseURL: `https://developer-api.govee.com/v1/`,
		headers: {
			'Govee-API-Key': process.env.GOOVE_API_KEY,
		},
	});

	override get id(): string {
		return 'govee-plugin';
	}

	override async beginLoad(): Promise<void> {
		const allDevicesResponse = await this.rest
			.get<GooveApiResponse<{ devices: IGooveDeviceRaw[] }>>('devices')
			.catch(console.error);
		if (allDevicesResponse) {
			allDevicesResponse.data.data.devices.forEach((d) => {
				if (d.controllable && d.retrievable) {
					this.devices.set(d.device, {
						device: d.device,
						model: d.model,
						name: d.deviceName,
						supportedCommands: d.supportCmds,
						properties: d.properties,
					});
				}
			});
		}
	}

	override get dirname() {
		return __dirname;
	}
}
