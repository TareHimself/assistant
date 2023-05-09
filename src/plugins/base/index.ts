import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { IIntent } from '@core/types';
const math = require('mathjs');
import { delay, pad } from '@core/utils';
import { wordsToDigits } from '@core/conversion';
import { PythonProcess } from '@core/subprocess';
import { compareTwoStrings } from 'string-similarity';
import { ELoadableState } from '@core/base';

type ArithmeticSkillData = {
	expression: string;
};
class ArithmeticSkill extends AssistantSkill<ArithmeticSkillData> {
	static OPERATORS: Record<string, string> = {
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

	promptToExpression(prompt: string) {
		return ArithmeticSkill.OPERATORS_KEYS.reduce((all, cur) => {
			return all.replaceAll(cur, ArithmeticSkill.OPERATORS[cur]);
		}, `${wordsToDigits(prompt)}`.toLowerCase())
			.replaceAll(ArithmeticSkill.REMOVE_FROM_EXPRESSION, '')
			.trim();
	}

	override shouldExecute(
		intent: string,
		source: AssistantContext,
		prompt: string
	): boolean {
		return this.promptToExpression(prompt).length > 0;
	}

	override async dataExtractor(
		instance: SkillInstance
	): Promise<ArithmeticSkillData> {
		return {
			expression: this.promptToExpression(instance.prompt),
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
					'generate #unk',
					'generate school',
					'generate #unk, #unk eyes',
					'generate [white hair | blue eyes | #unk dress | pink lips ], #unk, [skirt | #unk skin]',
					'generate red trees, #unk, two tables',
					'generate masterpiece, best quality, upper body, 1girl, looking at viewer, #unk hair, medium hair, #unk eyes, #unk horns, black coat, indoors',
					'generate masterpiece, big booty, #unk, goth, woman, purple eyes',
					'generate ninja, shuriken, #unk, stealth, assassin',
					'generate chef, apron, #unk, spatula',
					'generate wizard, hat, #unk, spells, magic',
					'generate detective, magnifying glass, #unk coat, fedora',
					'generate athlete, jersey, #unk, sneakers, water bottle',
					'generate pirate, eyepatch, #unk, peg leg',
					'generate vampire, #unk, coffin, cape, blood',
					'generate werewolf, claws, #unk moon, howl',
					'generate superhero, mask, cape, superpowers, secret identity',
					'generate angel, wings, halo, divine, guardian',
					'generate devil, #unk, pitchfork, fiery, tempter',
					'generate robot, #unk board, laser eyes, artificial intelligence',
					'generate mermaid, #unk bra, tail, underwater, mythical',
					'generate cowboy, hat, #unk, spurs, lasso',
					'generate spy, #unk, briefcase, stealth, espionage',
					'generate musician, guitar, #unk, stage, performance',
					'generate firefighter, #unk, helmet, hose, bravery',
					'generate samurai, armor, sword, honor, bushido',
					'generate ghost, #unk, white sheet, haunting, supernatural',
					'generate 2B, nier automata, woman, game, character, big booty',
					'generate wings, horns, #unk hair, medieval dress, girl, standing on a cliff, demon, sword',
					'generate glowing eyes, fur, ripped jeans, male, monster, black hair, #unk a cigarette, leather jacket, motorcycle',
					'generate dark alley, woman, witch, black dress, #unk hair, holding a spell book, glowing red eyes',
					'generate beach scene, merman, #unk hair, trident, tattoos, seashell necklace, man',
					'generate futuristic space station, android, red eyes, #unk hair, holding a laser sword, black bodysuit, woman',
					'generate concert stage, male, rockstar, #unk pants, ripped shirt, electric guitar, long hair, tattoos',
					'generate snowy forest, girl, white hair, wolf ears, blue eyes, holding #unk, fur cloak',
					'generate abandoned warehouse, woman, #unk, black catsuit, red eyes, short black hair, holding a knife',
					'generate moonlit garden, vampire, woman, red dress, long black hair, holding a glass of red wine',
					'generate underwater ruins, mermaid, #unk hair, trident, scales, green eyes, woman',
					'generate post-apocalyptic wasteland, man, survivor, gas mask, brown trench coat, holding a shotgun',
					'generate enchanted forest, elf, girl, #unk hair, pointed ears, holding a bow and arrow, brown eyes',
					'generate cyberpunk city, woman, hacker, black bodysuit, #unk hair, holding a laptop, red eyes',
					'generate dark castle, man, warlock, red robes, bald, holding a crystal ball, white beard',
					'generate amusement park, clown, woman, red nose, polka dot dress, holding a #unk animal',
					'generate ancient temple, man, archeologist, fedora hat, brown leather jacket, holding a #unk',
					'generate mystical garden, woman, druid, green dress, long brown hair, holding a #unk',
					'generate jungle scene, man, explorer, pith helmet, khaki shirt, holding a #unk',
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
				}:${pad(date.getMinutes(), 2)} ${date.getHours() < 12 ? 'am' : 'pm'}`
			)
		);
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
