import {
	AssistantContext,
	AssistantPlugin,
	AssistantSkill,
	SkillInstance,
} from '@core/assistant';
import { IIntent, IParsedEntity } from '@core/types';
const math = require('mathjs');
import { mostLikelyOption, pad } from '@core/utils';
import { wordsToDigits } from '@core/conversion';
import { PythonProcess } from '@core/subprocess';
import { compareTwoStrings } from 'string-similarity';
import { ELoadableState, EntityExtractionError } from '@core/base';
import { CgasApi } from '@core/singletons';
import { v4 as uuidv4 } from 'uuid';

class ArithmeticSkill extends AssistantSkill {
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
				tag: 'math',
				description: 'solves arithmetic expressions',
				entities: [
					{
						tag: 'expr',
						description: 'the expression to solve',
						extractor: (p) => {
							const expression = this.promptToExpression(p);
							if (expression.length === 0) {
								throw new EntityExtractionError();
							}
							return expression;
						},
					},
				],
				examples: [
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] nine minus six',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] 9 minus 4000',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] nine minus 6',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] 9 minus six',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [7 | seven] times six',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [11 | eleven] divided by seventeen',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [30 | thirty] plus one',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [40 | fourty] [* | times] [40 | f',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [seventy one | 71] [times | *] [sixty | 60]',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [fifty | 50] [/ | divided by] [ninety | 90]',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [thirty five | 35] [+ | plus] [70 | seventy]',
					'[math | Math | calculate | Calculate | arithmetic | Arithmetic] [ten | 10] plus [59 | fifty nine]',
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

	override shouldExecute(instance: SkillInstance): boolean {
		return instance.entities.some((a) => a.entity === 'expr');
	}

	override async execute(instance: SkillInstance): Promise<void> {
		instance.context.reply(
			ArithmeticSkill.POSSIBLE_RESPONSES.random().replace(
				'@ans',
				`${math.evaluate(
					this.promptToExpression(
						instance.entities.find((a) => a.entity === 'expr')?.data || ''
					)
				)}`
			)
		);
	}
}

class GenerateImageSkill extends AssistantSkill {
	override get intents(): IIntent[] {
		return [
			{
				tag: 'gen',
				description: 'generate images using stable diffusion',
				entities: [
					{
						tag: 'prompt',
						description: 'the prompt to use',
						extractor: (a) => a.split(' ').slice(1).join(' '),
					},
				],
				examples: [
					'[G|g]enerate microphone',
					'[G|g]enerate mask, school',
					'[G|g]enerate a man with a big jaw',
					'[G|g]enerate #unk',
					'[G|g]enerate school',
					'[G|g]enerate #unk, #unk eyes',
					'[G|g]enerate [white hair | blue eyes | #unk dress | pink lips ], #unk, [skirt | #unk skin]',
					'[G|g]enerate red trees, #unk, two tables',
					'[G|g]enerate masterpiece, best quality, upper body, 1girl, looking at viewer, #unk hair, medium hair, #unk eyes, #unk horns, black coat, indoors',
					'[G|g]enerate masterpiece, big booty, #unk, goth, woman, purple eyes',
					'[G|g]enerate ( ninja ), shuriken, #unk, stealth, ( assassin )',
					'[G|g]enerate chef, apron, #unk, spatula',
					'[G|g]enerate wizard, hat, #unk, spells, magic',
					'[G|g]enerate pirate, eyepatch, #unk, peg leg',
					'[G|g]enerate (vampire), #unk, coffin, ( cape), blood',
					'[G|g]enerate werewolf, claws, #unk moon, howl',
					'[G|g]enerate superhero, mask, cape, superpowers, secret identity',
					'[G|g]enerate angel, wings, halo, divine, guardian',
					'[G|g]enerate devil, #unk, pitchfork, fiery, tempter',
					'[G|g]enerate robot, #unk board, laser eyes, artificial intelligence',
					'[G|g]enerate mermaid, #unk bra, tail, underwater, mythical',
					'[G|g]enerate cowboy, hat, #unk, spurs, lasso',
					'[G|g]enerate spy, #unk, briefcase, stealth, espionage',
					'[G|g]enerate (musician), guitar, #unk, stage, performance',
					'[G|g]enerate firefighter, #unk, helmet, hose, bravery',
					'[G|g]enerate samurai, armor, sword, honor, bushido',
					'[G|g]enerate ghost, #unk, white sheet, haunting, supernatural',
					'[G|g]enerate 2B, nier automata, woman, game, character, big booty',
					'[G|g]enerate wings, horns, #unk hair, medieval dress, girl, standing on a cliff, demon, sword',
					'[G|g]enerate glowing eyes, fur, ripped jeans, male, monster, black hair, #unk a cigarette, leather jacket, motorcycle',
					'[G|g]enerate dark alley, woman, witch, black dress, #unk hair, holding a spell book, glowing red eyes',
					'[G|g]enerate abandoned warehouse, woman, #unk, black catsuit, red eyes, short black hair, holding a knife',
					'[G|g]enerate moonlit garden, vampire, woman, red dress, long black hair, holding a glass of red wine',
					'[G|g]enerate underwater ruins, mermaid, #unk hair, trident, scales, green eyes, woman',
					'[G|g]enerate amusement park, clown, woman, red nose, polka dot dress, holding a #unk animal',
					'[G|g]enerate ancient temple, man, archeologist, fedora hat, brown leather jacket, holding a #unk',
					'[G|g]enerate mystical garden, woman, druid, green dress, long brown hair, holding a #unk',
					'[G|g]enerate jungle scene, man, explorer, pith helmet, khaki shirt, holding a #unk',
					'[G|g]enerate (best quality, masterpiece), 1girl, particle, wind, flower, upper body, dark simple background, looking at viewer, blonde, galaxy <params:size:504x1009> <params:seed:736669780> <params:control:8> <params:steps:25>',
				],
			},
		];
	}

	generator = new PythonProcess('diffusion.py');
	isGeneratingImage = false;
	generationQueue: (() => any)[] = [];
	static AVAILABLE_MODELS = {
		normal: 'HeWhoRemixes/anything-v4.5-pruned-fp16',
		pastel: 'HeWhoRemixes/pastelmix-better-vae-fp16',
		cartoon: 'HeWhoRemixes/seekyou-alpha1-fp16',
	};

	override async onLoad(): Promise<void> {
		// this.generator.on('onProcessStdout', (b) => console.info(b.toString()));
		// this.generator.on('onProcessError', (b) => console.info(b.toString()));
		await this.generator.waitForState(ELoadableState.ACTIVE);
	}

	override shouldExecute(instance: SkillInstance): boolean {
		return instance.entities.find((a) => a.entity === 'prompt') !== undefined;
	}

	waitForTurn(instance: SkillInstance) {
		if (this.isGeneratingImage) {
			return new Promise<void>((res) => {
				this.generationQueue.push(res);
				instance.context.reply(
					`Your request has been queued, position ${this.generationQueue.length}`
				);
			});
		}
		this.isGeneratingImage = true;
	}

	override async execute(instance: SkillInstance): Promise<void> {
		const possibleTypes = Object.keys(GenerateImageSkill.AVAILABLE_MODELS);

		const type = (
			(await instance.context.getInput(
				`What style would you like ${possibleTypes.join(', ')} ?`
			)) || ''
		).toLowerCase();

		let selection = mostLikelyOption(type, possibleTypes);

		if (GenerateImageSkill.AVAILABLE_MODELS[selection].length === 0) {
			// cartoon does not work
			selection = possibleTypes[0];
		}
		console.info(`Using ${selection} model`);

		const needToWait = this.waitForTurn(instance);
		if (needToWait !== undefined) {
			await needToWait;
		}

		instance.context.reply('Generating');

		const [_, generatedImage] = await this.generator.sendAndWait(
			Buffer.from(
				JSON.stringify({
					model_id: GenerateImageSkill.AVAILABLE_MODELS[selection],
					prompt:
						instance.entities.find((a) => a.entity === 'prompt')?.data || '',
				})
			)
		);

		const pending = this.generationQueue.pop();

		if (pending) {
			pending();
		} else if (this.isGeneratingImage) {
			this.isGeneratingImage = false;
		}

		const uploadedImage = await CgasApi.get().upload(
			`generate-image-${uuidv4()}.png`,
			generatedImage
		);

		if (!uploadedImage) {
			instance.context.reply('There was an issue uploading the image.');
			return;
		}

		await instance.context.reply(`Done Generating ${uploadedImage.url}`);
	}
}

class ScheduleSkill extends AssistantSkill {
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
		console.log('Remind command', instance.context);
	}
}

class TimeSkill extends AssistantSkill {
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
				examples: [
					'[W|w]hat time is it',
					'[T|t]ime',
					'[T|t]ime pls',
					'[T|t]ime boii',
				],
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
		];
	}
}
