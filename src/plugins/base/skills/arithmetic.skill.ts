import { AssistantSkill, SkillInstance } from '@core/assistant';
import { EntityExtractionError } from '@core/base';
import { wordsToDigits } from '@core/conversion';
import { IIntent } from '@core/types';
import { evaluate as evalMath } from 'mathjs';

export default class ArithmeticSkill extends AssistantSkill {
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
		const toEval = instance.entities.find((a) => a.entity === 'expr')?.data || ''
		console.info("Evaling ",toEval)
		const result = evalMath(
			toEval
		)
		console.info("Result",result)
		instance.context.reply(
			ArithmeticSkill.POSSIBLE_RESPONSES.random().replace(
				'@ans',
				`${result}`
			)
		);
	}
}
