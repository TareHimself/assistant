const WORDS_TO_DIGITS: { [key: string]: number | undefined } = {
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
	twenty: 20,
	thirty: 30,
	fourty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90,
};

const WORDS_TO_DIGITS_EXPONENTS: { [key: string]: number | undefined } = {
	hundred: 1e2,
	thousand: 1e3,
	million: 1e6,
	billion: 1e9,
	trillion: 1e12,
};

const DIGITS_TO_WORDS: { [key: string]: string | undefined } = {
	'1': 'one',
	'2': 'two',
	'3': 'three',
	'4': 'four',
	'5': 'five',
	'6': 'six',
	'7': 'seven',
	'8': 'eight',
	'9': 'nine',
	'10': 'ten',
	'11': 'eleven',
	'12': 'twelve',
	'13': 'thirteen',
	'14': 'fourteen',
	'15': 'fifteen',
	'16': 'sixteen',
	'17': 'seventeen',
	'18': 'eighteen',
	'19': 'nineteen',
	'20': 'twenty',
	'30': 'thirty',
	'40': 'fourty',
	'50': 'fifty',
	'60': 'sixty',
	'70': 'seventy',
	'80': 'eighty',
	'90': 'ninety',
};

const DIGITS_TO_WORDS_EXPONENTS: { [key: string]: string | undefined } = {
	1e3: 'thousand',
	1e6: 'million',
	1e9: 'billion',
	1e12: 'trillion',
};

const DIGITS_REGEX = /[\d]+/;

// const PUNCTUATION_REGEX = /[!._,'@?\/\/s]/;

export function wordsToDigits(words: string) {
	let pending: number[] = [];

	let finalWord = words.split(' ').reduce((result, current) => {
		const item = current.toLowerCase();

		if (
			item.trim() === 'and' ||
			(item.trim() === ',' && pending !== undefined)
		) {
			return result;
		}

		if (WORDS_TO_DIGITS[item] !== undefined) {
			if (pending.length === 0) pending = [0];

			pending[0] += WORDS_TO_DIGITS[item]!;

			return result;
		} else if (
			WORDS_TO_DIGITS_EXPONENTS[item] !== undefined &&
			pending.length > 0
		) {
			pending[0] = WORDS_TO_DIGITS_EXPONENTS[item]! * pending[0];

			if (
				WORDS_TO_DIGITS_EXPONENTS[item] !== WORDS_TO_DIGITS_EXPONENTS['hundred']
			) {
				pending.unshift(0);
			}

			return result;
		} else if (pending.length > 0) {
			const final = `${result} ${pending.reduce(
				(a, b) => a + b,
				0
			)} ${current}`;
			pending = [];
			return final;
		}

		return `${result} ${current}`;
	}, '');

	if (pending.length > 0) {
		finalWord += ` ${pending.reduce((a, b) => a + b, 0)}`;
	}

	return finalWord.trim();
}

export function digitToWord(digit: string | number) {
	const digitAsString = typeof digit === 'string' ? digit : `${digit}`;
	const indexes: string[] = [];

	for (let i = digitAsString.length; i > 0; i -= 3) {
		indexes.unshift(digitAsString.slice(Math.max(i - 3, 0), i));
	}

	let idx = 0;

	return indexes
		.reduce((final, current) => {
			const exponent = Math.pow(10, (indexes.length - 1 - idx) * 3);
			const item =
				current.length === 3
					? current
					: current.length === 1
					? `xx${current}`
					: `x${current}`;
			let end = DIGITS_TO_WORDS_EXPONENTS[exponent]
				? DIGITS_TO_WORDS_EXPONENTS[exponent]
				: '';
			let start = DIGITS_TO_WORDS[item[0]]
				? `${DIGITS_TO_WORDS[item[0]]} hundred`
				: '';
			let middle = '';
			if (item[1] !== 'x') {
				if (DIGITS_TO_WORDS[`${item[1]}${item[2]}`]) {
					middle = DIGITS_TO_WORDS[`${item[1]}${item[2]}`]!;
				} else {
					middle = `${DIGITS_TO_WORDS[`${item[1]}0`]} ${
						DIGITS_TO_WORDS[`${item[2]}`]
					}`;
				}
			} else {
				middle = `${DIGITS_TO_WORDS[item[2]]}`;
			}

			if (middle && start) {
				middle = `and ${middle}`;
			}

			const curStatement =
				[start, middle, end, idx === indexes.length - 2 ? ',' : ''].join(' ') +
				' ';
			idx++;
			return final + curStatement;
		}, '')
		.trim();
}

export function digitsToWords(digits: string) {
	return digits
		.split(' ')
		.map((current) => {
			const match = current.match(DIGITS_REGEX);
			if (match) {
				return current.replace(match[0], digitToWord(match[0]));
			}
			return current;
		})
		.join(' ');
}
