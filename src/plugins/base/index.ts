import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { IIntent } from '@core/types';
import math = require('mathjs');
import { delay, pad } from '@core/utils';
import { digitsToWords, wordsToDigits } from '@core/conversion';
import { PythonProcess } from '@core/subprocess';
import { compareTwoStrings } from 'string-similarity';
import { ELoadableState } from '@core/base';

type ArithmeticSkillData = {
	expression: string;
};
class ArithmeticSkill extends AssistantSkill<ArithmeticSkillData> {
	static OPERATORS = {
		'divided by': '/',
		times: '*',
		'multiplied by': '',
		minus: '-',
		plus: '+',
	};
	static OPERATORS_KEYS = Object.keys(ArithmeticSkill.OPERATORS);
	static REMOVE_FROM_EXPRESSION = new RegExp(/[a-zA-Z]+/, 'ig');
	static POSSIBLE_RESPONSES = [
		'I got @ans',
		'The answer is @ans',
		'My math says @ans',
		"@ans, but don't quote me.",
		'@ans',
	];
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_arithmetic',
				examples: [
					'[math | calculate | arithmetic] nine minus six',
					'[math | calculate | arithmetic] 9 minus 4000',
					'[math | calculate | arithmetic] nine minus 6',
					'[math | calculate | arithmetic] 9 minus six',
					'[math | calculate | arithmetic] [7 | seven] times six',
					'[math | calculate | arithmetic] [11 | eleven] divided by seventeen',
					'[math | calculate | arithmetic] [30 | thirty] plus one',
					'[math | calculate | arithmetic] [40 | fourty] [* | times] [40 | f',
					'[math | calculate | arithmetic] [seventy one | 71] [times | *] [sixty | 60]',
					'[math | calculate | arithmetic] [fifty | 50] [/ | divided by] [ninety | 90]',
					'[math | calculate | arithmetic] [thirty five | 35] [+ | plus] [70 | seventy]',
					'[math | calculate | arithmetic] [ten | 10] plus [59 | fifty nine]',
				],
			},
		];
	}

	override async dataExtractor(
		instance: SkillInstance
	): Promise<ArithmeticSkillData> {
		const expression = ArithmeticSkill.OPERATORS_KEYS.reduce((all, cur) => {
			return all.replaceAll(cur, ArithmeticSkill.OPERATORS[cur]);
		}, `${wordsToDigits(instance.prompt)}`.toLowerCase());

		return {
			expression: expression
				.replaceAll(ArithmeticSkill.REMOVE_FROM_EXPRESSION, '')
				.trim(),
		};
	}

	override async execute(
		instance: SkillInstance,
		data: ArithmeticSkillData
	): Promise<void> {
		instance.context.reply(
			ArithmeticSkill.POSSIBLE_RESPONSES.random().replace(
				'@ans',
				`${math.evaluate(data.expression)}`
			)
		);
	}
}

type GenerateImageSkillData = {
	tags: string;
};

class GenerateImageSkill extends AssistantSkill<GenerateImageSkillData> {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_generate_anime',
				examples: [
					'generate beans',
					'generate school',
					'generate house',
					'generate [white hair | blue eyes | white dress | pink lips ], [glasses | horns | purple eyes], [skirt | ember skin]',
					'generate red trees, 1girl, two tables',
					'generate masterpiece, best quality, upper body, 1girl, looking at viewer, red hair, medium hair, purple eyes, demon horns, black coat, indoors',
					'generate masterpiece, big booty, thick, goth, woman, purple eyes',
					'generate ninja, shuriken, katana, stealth, assassin',
					'generate chef, apron, rolling pin, spatula',
					'generate wizard, hat, wand, spells, magic',
					'generate detective, magnifying glass, trench coat, fedora',
					'generate athlete, jersey, sweatband, sneakers, water bottle',
					'generate pirate, eyepatch, parrot, peg leg',
					'generate vampire, fangs, coffin, cape, blood',
					'generate werewolf, claws, full moon, howl',
					'generate superhero, mask, cape, superpowers, secret identity',
					'generate angel, wings, halo, divine, guardian',
					'generate devil, horns, pitchfork, fiery, tempter',
					'generate robot, circuit board, laser eyes, artificial intelligence',
					'generate mermaid, seashell bra, tail, underwater, mythical',
					'generate cowboy, hat, boots, spurs, lasso',
					'generate spy, sunglasses, briefcase, stealth, espionage',
					'generate musician, guitar, microphone, stage, performance',
					'generate firefighter, axe, helmet, hose, bravery',
					'generate samurai, armor, sword, honor, bushido',
					'generate ghost, chains, white sheet, haunting, supernatural',
					'generate 2B, nier automata, woman, game, character, big booty',
					'generate wings, horns, red hair, medieval dress, girl, standing on a cliff, demon, sword',
					'generate glowing eyes, fur, ripped jeans, male, monster, black hair, smoking a cigarette, leather jacket, motorcycle',
					'generate dark alley, woman, witch, black dress, purple hair, holding a spell book, glowing red eyes',
					'generate beach scene, merman, blue hair, trident, tattoos, seashell necklace, man',
					'generate futuristic space station, android, red eyes, silver hair, holding a laser sword, black bodysuit, woman',
					'generate concert stage, male, rockstar, leather pants, ripped shirt, electric guitar, long hair, tattoos',
					'generate snowy forest, girl, white hair, wolf ears, blue eyes, holding a staff, fur cloak',
					'generate abandoned warehouse, woman, assassin, black catsuit, red eyes, short black hair, holding a knife',
					'generate moonlit garden, vampire, woman, red dress, long black hair, holding a glass of red wine',
					'generate underwater ruins, mermaid, pink hair, trident, scales, green eyes, woman',
					'generate post-apocalyptic wasteland, man, survivor, gas mask, brown trench coat, holding a shotgun',
					'generate enchanted forest, elf, girl, green hair, pointed ears, holding a bow and arrow, brown eyes',
					'generate cyberpunk city, woman, hacker, black bodysuit, pink hair, holding a laptop, red eyes',
					'generate dark castle, man, warlock, red robes, bald, holding a crystal ball, white beard',
					'generate amusement park, clown, woman, red nose, polka dot dress, holding a balloon animal',
					'generate ancient temple, man, archeologist, fedora hat, brown leather jacket, holding a torch',
					'generate mystical garden, woman, druid, green dress, long brown hair, holding a staff',
					'generate jungle scene, man, explorer, pith helmet, khaki shirt, holding a machete',
				],
			},
		];
	}

	generator = new PythonProcess('image_generator.py');
	isGeneratingImage = false;
	generationQueue: (() => any)[] = [];

	override async onLoad(): Promise<void> {
		// this.generator.on('onProcessStdout', (b) => console.info(b.toString()));
		// this.generator.on('onProcessError', (b) => console.info(b.toString()));
		await this.generator.waitForState(ELoadableState.ACTIVE);
	}

	override async dataExtractor(
		instance: SkillInstance
	): Promise<GenerateImageSkillData> {
		return {
			tags: instance.prompt.replace('generate', ''),
		};
	}

	override async execute(
		instance: SkillInstance,
		data: GenerateImageSkillData
	): Promise<void> {
		const type = (
			(await instance.context.getInput(
				'What style would you like , pastel or normal ?'
			)) || ''
		).toLowerCase();

		const bShouldUsePastel =
			compareTwoStrings(type, 'pastel') > compareTwoStrings(type, 'normal');

		const selectedModel = bShouldUsePastel ? 1 : 2;

		console.info(`Using ${bShouldUsePastel ? 'pastel' : 'normal'} model`);

		if (this.isGeneratingImage) {
			await new Promise<void>((res) => {
				this.generationQueue.push(res);
				instance.context.reply(
					`Your request has been queued, position ${this.generationQueue.length}`
				);
			});
		}

		this.isGeneratingImage = true;

		instance.context.reply('Generating');

		const [op, response] = await this.generator.sendAndWait(
			Buffer.from(data.tags),
			selectedModel
		);

		const pending = this.generationQueue.pop();

		if (pending) {
			pending();
		} else if (this.isGeneratingImage) {
			this.isGeneratingImage = false;
		}

		await instance.context.replyImage(response);

		instance.context.reply(`Done Generating`);
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
		instance: SkillInstance
	): Promise<IScheduleAddParams> {
		const [_, task, time] = instance.prompt.match(this.extractionRegexp)!;
		return {
			task: task,
			time: time,
		};
	}
}

class TimeSkill extends AssistantSkill<null> {
	static POSSIBLE_RESPONSES = [
		'The time is @ans',
		"Right now it's @ans",
		'@ans',
		'It is @ans',
	];
	override get intents(): IIntent[] {
		return [
			{
				tag: 'skill_time',
				examples: ['what time is it', 'time'],
			},
		];
	}

	override async dataExtractor(instance: SkillInstance): Promise<null> {
		return null;
	}

	override async execute(instance: SkillInstance, data: null): Promise<void> {
		const date = new Date();
		instance.context.reply(
			TimeSkill.POSSIBLE_RESPONSES.random().replace(
				'@ans',
				`${
					date.getHours() !== 12 ? date.getHours() % 12 : date.getHours()
				}:${pad(date.getMinutes())} ${date.getHours() < 12 ? 'am' : 'pm'}`
			)
		);
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

	override async dataExtractor(instance: SkillInstance) {
		const [_, toSpeak] = instance.prompt.match(this.extractionRegexp)!;
		return {
			phrase: toSpeak,
		};
	}

	override async execute(instance: SkillInstance, data: ISpeakSkillData) {
		instance.context.reply(data.phrase);
	}
}

export default class BasePlugin extends AssistantPlugin {
	override get id(): string {
		return 'base-plugin';
	}

	override async getSkills(): Promise<AssistantSkill[]> {
		return [
			new ArithmeticSkill(),
			new TimeSkill(),
			new ScheduleSkill(),
			new SpeakSkill(),
			new GenerateImageSkill(),
			new (class PromptTest extends AssistantSkill<null> {
				get intents() {
					return [
						{
							tag: 'test_prompt',
							examples: ['prompt test'],
						},
					];
				}

				override async dataExtractor(instance: SkillInstance): Promise<null> {
					return null;
				}
				override async execute(
					instance: SkillInstance,
					data: null
				): Promise<void> {
					do {
						const response = await instance.context.getInput(
							'Say something pls'
						);
						instance.context.reply(`You said \`${response}\``);
						await delay(1000);
					} while (
						!(await instance.context.getInput('Do you want to do it again ?'))
							?.toLowerCase()
							.trim()
							.startsWith('n')
					);

					instance.context.reply(`Prompt test over`);
				}
			})(),
		];
	}
}
