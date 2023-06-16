import { AssistantSkill, SkillInstance } from '@core/assistant';
import { IIntent } from '@core/types';

export default class ScheduleSkill extends AssistantSkill {
	extractionRegexp = new RegExp(
		/(?:remind (?:me (?:to )))?(.+?)(?:\sin(?: a| an)?|\sat)\s(.*)/,
		'i'
	);
	override get intents(): IIntent[] {
		return [
			{
				tag: 's_sch_add',
				description: 'add a task to my schedule',
				entities: [
					// {
					// 	tag: 'task',
					// 	description: 'the task to add',
					// },
					// {
					// 	tag: 'time',
					// 	description: 'target time',
					// },
				],
				examples: [
					'[R|r]emind me to smoke weed at five am',
					'[R|r]emind me to take a shit by twelve pm',
					'[R|r]emind me to stop in an hour',
					'[R|r]emind me to jump off my roof, then call some people in a second',
					'[R|r]emind me to go to sleep immediately in forty eight hours twelve minutes and seventy seconds',
					'[R|r]emind me to do a thing and then another thing, with more things in fifteen minutes and thirty nine seconds',
					'[R|r]emind me to sleep in twenty five seconds and ten minutes',
					'[R|r]emind me to wear my socks in thirty nine minutes and three days',
					'[R|r]emind me to die in ten minutes',
				],
			},
		];
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return instance.entities.length === 2;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		console.info('Remind command', instance.context);
	}
}
