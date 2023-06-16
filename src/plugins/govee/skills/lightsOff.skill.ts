import { AssistantSkill, SkillInstance } from '@core/assistant';
import { SkillExecutionError } from '@core/base';
import GoveePlugin from '..';

export default class LightsControlOff extends AssistantSkill<GoveePlugin> {
	override get intents() {
		return [
			{
				tag: 'lights_off',
				description: 'turns off lights',
				entities: [],
				examples: ['[T|t]urn off the lights', '[L|l]ights off'],
			},
		];
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const allDevices = Array.from(this.plugin.devices.values());
		const device = allDevices[0];
		if (!device) {
			throw new SkillExecutionError('No devices available');
		}

		await this.plugin.rest.put('devices/control', {
			device: device.device,
			model: device.model,
			cmd: {
				name: 'turn',
				value: 'off',
			},
		});

		instance.context.reply('Turned off the lights');
	}
}
