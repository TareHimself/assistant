import { AssistantSkill, SkillInstance } from '@core/assistant';
import { IIntent } from '@core/types';
import { pad } from '@core/utils';

export default class TimeSkill extends AssistantSkill {
	static POSSIBLE_RESPONSES = [
		'The time is @ans',
		"Right now it's @ans",
		'@ans',
		'It is @ans',
	];
	override get intents(): IIntent[] {
		return [
			{
				tag: 's_time',
				description: 'gets the time',
				entities: [],
				examples: ['[W|w]hat time is it', '[T|t]ime', '[T|t]ime pls'],
			},
		];
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return true;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const date = new Date();
		instance.context.reply(
			TimeSkill.POSSIBLE_RESPONSES.random().replace(
				'@ans',
				`${
					date.getHours() !== 12 ? date.getHours() % 12 : date.getHours()
				}:${pad(date.getMinutes(), 2)} ${date.getHours() < 12 ? 'am' : 'pm'}`
			)
		);
	}
}
