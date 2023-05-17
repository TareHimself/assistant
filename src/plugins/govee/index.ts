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
					'[T|t]urn on the lights',
					'[L|l]ights on',
					'[L|l]ights',
					'[L|l]et there be light',
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
				examples: ['[T|t]urn off the lights', '[L|l]ights off'],
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
