import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
} from '@core/assistant';
import { IIntent } from '@core/types';

class ArithmeticSkill extends AssistantSkill<null> {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_arithmetic',
				examples: [
					'[what is | math | calculate | arithmetic] nine minus six',
					'[what is | math | calculate | arithmetic] nine minus 4000',
					'[what is | math | calculate | arithmetic] nine minus 6',
					'[what is | math | calculate | arithmetic] nine minus six',
					'[what is | math | calculate | arithmetic] is 7 times six',
					'[what is | math | calculate | arithmetic] 11 divided by seventeen',
					'[what is | math | calculate | arithmetic] thirty plus one',
					'[what is | math | calculate | arithmetic] [40 | fourty] [* | times] [40 | f',
					'[what is | math | calculate | arithmetic] is [seventy one | 71] [times | *] [sixty | 60]',
					'[what is | math | calculate | arithmetic] [fifty | 50] [/ | divided by] [ninety | 90]',
					'[what is | math | calculate | arithmetic] [thirty five | 35] [+ | plus] [70 | seventy]',
					'[what is | math | calculate | arithmetic] [ten | 10] plus [59 | fifty nine]',
				],
			},
		];
	}

	override async dataExtractor(intent: string, prompt: string): Promise<null> {
		return null;
	}
}

class AppOpenCloseSkill extends AssistantSkill<null> {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_app_open',
				examples: [
					'launch spotify',
					'open google',
					'launch in the morning i will die',
					'open my balls n your jaw',
					'launch microsoft edge',
					'open epic games',
					'launch keyboard maker',
					'open mic tuner',
					'launch supa hot fire',
					'open sexy ladies',
					'launch no mans sky',
					'open genshin impact',
				],
			},
			{
				tag: 'skill_app_close',
				examples: [
					'close spotify',
					'quit google',
					'close osu',
					'close vscode',
					'quit microsoft edge',
					'quit epic games',
					'close steam',
					'close no mans sky',
				],
			},
		];
	}

	override async dataExtractor(intent: string, prompt: string): Promise<null> {
		return null;
	}
}

class WebSearchSkill extends AssistantSkill<null> {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_web_search',
				examples: [
					'look up men in suits',
					'google balls in your jaw video',
					'search for math answers',
					'look up great pretender',
					'google wacha cha cha',
					'search gibrish ',
					'look up men in suits',
					'google man',
					'search The quick brown fox jumps over the lazy dog',
				],
			},
		];
	}

	override async dataExtractor(intent: string, prompt: string): Promise<null> {
		return null;
	}
}

type IScheduleAddParams = {
	task: string;
	time: string;
};

class ScheduleSkill extends AssistantSkill<IScheduleAddParams> {
	extractionRegexp = new RegExp(
		/(?:remind (?:me (?:to )))?(.+?)(?:\sin(?: a| an)?|\sat)\s(.*)/,
		'i'
	);
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_schedule_add',
				examples: [
					'remind me to smoke weed at five am',
					'remind me to take a shit by twelve pm',
					'remind me to stop in an hour',
					'remind me to jump off my roof, then call some people in a second',
					'remind me to go to sleep immediately in forty eight hours twelve minutes and seventy seconds',
					'remind me to do a thing and then another thing, with more things in fifteen minutes and thirty nine seconds',
					'remind me to sleep in twenty five seconds and ten minutes',
					'remind me to wear my socks in thirty nine minutes and three days',
					'remind me to die in ten minutes',
				],
			},
		];
	}

	override shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return prompt.match(this.extractionRegexp) !== null;
	}

	override async dataExtractor(
		intent: string,
		prompt: string
	): Promise<IScheduleAddParams> {
		const [_, task, time] = prompt.match(this.extractionRegexp)!;
		return {
			task: task,
			time: time,
		};
	}
}

class TimeSkill extends AssistantSkill<null> {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_time',
				examples: ['what time is it', 'what is the time', 'time'],
			},
		];
	}

	override async dataExtractor(intent: string, prompt: string): Promise<null> {
		return null;
	}
}

export interface ISpeakSkillData {
	phrase: string;
}

class SpeakSkill extends AssistantSkill<ISpeakSkillData> {
	extractionRegexp = new RegExp(/(?:(?:say|speak|repeat)\s?)(.*)/, 'i');
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_self_say',
				examples: [
					'say wakanda forever',
					'[say | speak] [what time is it | what is the time | remind me to do something | italian baby]',
					'[say | speak] [sea shells and shit | can i put this in your mouth | when can i become human]',
					'[say | speak] The red van was pulling a trailer with a beat-up lawn mower on it',
					'[say | speak] Everything has a beginning and an end',
					'[say | speak] We can go to the oark',
					"[say | speak] I don't like the polluted atmosphere of big cities",
					'[say | speak] She constantly thought she was one mistake away from being fired',
					"[say | speak] It's the biggest sports shop in the region",
					'[say | speak] My home is bright pink and has yellow flowers growing all around it',
					'[say | speak] I’m a hundred percent certain that it is going to rain later today',
					'[say | speak] Sit down and shut up',
					'[say | speak] I brought home the trophy',
					'[say | speak] Business costs will go down',
					'[say | speak] I need to go home',
					'[say | speak] A list of required hardware is available here',
					'[say | speak] The bigger boys torment the little ones',
					'[say | speak] I miss my girlfriend',
					'[say | speak] Workers will not be empowered',
					'[say | speak] He’s as proud as a peacock',
					'[say | speak] Tom made a big donation to the hospital',
					'[say | speak] He has a nice sum of money put away',
					'[say | speak] We should be able to resolve our differences',
				],
			},
		];
	}

	override shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return this.extractionRegexp.test(prompt);
	}

	override async dataExtractor(intent: string, prompt: string) {
		const [_, toSpeak] = prompt.match(this.extractionRegexp)!;
		return {
			phrase: toSpeak,
		};
	}

	override async execute(
		intent: string,
		source: AssistantContext,
		prompt: string,
		data: ISpeakSkillData
	) {
		source.reply(data.phrase);
	}
}

export default class BasePlugin extends AssistantPlugin {
	override get id(): string {
		return 'base-plugin';
	}
	override async getSkills(): Promise<AssistantSkill[]> {
		return [
			new ArithmeticSkill(),
			new AppOpenCloseSkill(),
			new WebSearchSkill(),
			new TimeSkill(),
			new ScheduleSkill(),
			new SpeakSkill(),
		];
	}

	override async getIntents(): Promise<IIntent[]> {
		return [
			{
				tag: 'skill_affirm',
				examples: ['Yes', 'sure', 'ok'],
			},
			{
				tag: 'skill_reject',
				examples: ['no', 'nevermind', 'dont worry'],
			},
		];
	}
}
