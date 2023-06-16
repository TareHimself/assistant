import { AssistantSkill, SkillInstance } from '@core/assistant';
import GoveePlugin from '..';

export default class LightsControlOn extends AssistantSkill<GoveePlugin> {
	override get intents() {
		return [
			{
				tag: 'lights_on',
				description: 'turns on lights',
				entities: [],
				examples: [
					'[T|t]urn on the lights',
					'[L|l]ights on',
					'[L|l]ights',
					'[L|l]et there be light',
				],
			},
		];
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const allDevices = Array.from(this.plugin.devices.values());
		const device = allDevices[0];
		if (!device) {
			return super.execute(instance);
		}

		await this.plugin.rest.put('devices/control', {
			device: device.device,
			model: device.model,
			cmd: {
				name: 'turn',
				value: 'on',
			},
		});

		instance.context.reply('Turned on the lights');
	}
}
