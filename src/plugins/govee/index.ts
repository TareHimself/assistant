import {
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { IIntent } from '@core/types';

class LightsControlOn extends AssistantSkill {
	override get intents() {
		return [
			{
				tag: 'lights_on',
				description: 'turns on lights',
				entities: [],
				examples: [
					'Turn on the lights',
					'lights on',
					'lights',
					'let there be light',
				],
			},
		];
	}

	override async execute(instance: SkillInstance): Promise<void> {
		instance.context.reply('Turned on the lights');
	}
}

class LightsControlOff extends AssistantSkill {
	override get intents() {
		return [
			{
				tag: 'lights_off',
				description: 'turns off lights',
				entities: [],
				examples: ['Turn off the lights', 'lights off'],
			},
		];
	}

	override async execute(instance: SkillInstance): Promise<void> {
		instance.context.reply('Turned off the lights');
	}
}

export default class GoveePlugin extends AssistantPlugin {
	override get id(): string {
		return 'govee-plugin';
	}

	override async getSkills(): Promise<AssistantSkill[]> {
		return [new LightsControlOn(), new LightsControlOff()];
	}
}
