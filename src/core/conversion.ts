const WORDS_TO_DIGITS  = {
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
} as const;

const WORDS_TO_DIGITS_EXPONENTS = {
	hundred: 1e2,
	thousand: 1e3,
	million: 1e6,
	billion: 1e9,
	trillion: 1e12,
} as const;

const DIGITS_TO_WORDS = {
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
} as const;

const DIGITS_TO_WORDS_EXPONENTS = {
	1e2: 'hundred',
	1e3: 'thousand',
	1e6: 'million',
	1e9: 'billion',
	1e12: 'trillion',
} as const;

const DIGITS_REGEX = /([\d]+\.[\d]+|[\d]+)/;
const SPLIT_TEXT_REGEX = /(?:[\d]+\.[\d]+|[\d]+)|\b\w+\b|[\W]/gm
const SECTION_REGEX = /[\d]{3}/gm
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

		if (WORDS_TO_DIGITS[item as keyof typeof WORDS_TO_DIGITS] !== undefined) {
			if (pending.length === 0) pending = [0];

			pending[0] += WORDS_TO_DIGITS[item as keyof typeof WORDS_TO_DIGITS]!;

			return result;
		} else if (
			WORDS_TO_DIGITS_EXPONENTS[item as keyof typeof WORDS_TO_DIGITS_EXPONENTS] !== undefined &&
			pending.length > 0
		) {
			pending[0] = WORDS_TO_DIGITS_EXPONENTS[item as keyof typeof WORDS_TO_DIGITS_EXPONENTS]! * pending[0];

			if (
				WORDS_TO_DIGITS_EXPONENTS[item as keyof typeof WORDS_TO_DIGITS_EXPONENTS] !== WORDS_TO_DIGITS_EXPONENTS['hundred']
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

// export function digitToWord(digit: string | number) {

// 	const digitAsString = typeof digit === 'string' ? digit : `${digit}`;
// 	const indexes: string[] = [];

// 	for (let i = digitAsString.length; i > 0; i -= 3) {
// 		indexes.unshift(digitAsString.slice(Math.max(i - 3, 0), i));
// 	}

// 	let idx = 0;

// 	return indexes
// 		.reduce((final, current) => {
// 			const exponent = Math.pow(10, (indexes.length - 1 - idx) * 3);
// 			const item =
// 				current.length === 3
// 					? current
// 					: current.length === 1
// 					? `xx${current}`
// 					: `x${current}`;
// 			let end = DIGITS_TO_WORDS_EXPONENTS[exponent]
// 				? DIGITS_TO_WORDS_EXPONENTS[exponent]
// 				: '';
// 			let start = DIGITS_TO_WORDS[item[0]]
// 				? `${DIGITS_TO_WORDS[item[0]]} hundred`
// 				: '';
// 			let middle = '';
// 			if (item[1] !== 'x') {
// 				if (DIGITS_TO_WORDS[`${item[1]}${item[2]}`]) {
// 					middle = DIGITS_TO_WORDS[`${item[1]}${item[2]}`]!;
// 				} else {
// 					middle = `${DIGITS_TO_WORDS[`${item[1]}0`]} ${
// 						DIGITS_TO_WORDS[`${item[2]}`]
// 					}`;
// 				}
// 			} else {
// 				middle = `${DIGITS_TO_WORDS[item[2]]}`;
// 			}

// 			if (middle && start) {
// 				middle = `and ${middle}`;
// 			}

// 			const curStatement =
// 				[start, middle, end, idx === indexes.length - 2 ? ',' : ''].join(' ') +
// 				' ';
// 			idx++;
// 			return final + curStatement;
// 		}, '')
// 		.trim();
// }

export function digitToWord(digit: string | number) {

	const digitAsString = typeof digit === 'string' ? digit : `${digit}`;

	let [toSection,decimals] = digitAsString.split('.')
	const sections: string[] = []
	if(toSection.length % 3 !== 0){
		const sectionArr = toSection.split('')
		sections.push(sectionArr.splice(0,toSection.length % 3).join(''))
		toSection = sectionArr.join('')
	}

	decimals = decimals ?? ''

	sections.push(...Array.from(toSection.matchAll(SECTION_REGEX)).map(a => a[0]))

	if(decimals.length > 0){
		decimals = " point " + decimals.split('').map(a => DIGITS_TO_WORDS[a as keyof typeof DIGITS_TO_WORDS]).join(' ')
	}

	return sections.reduce((result,section,idx,arr)=>{
		const exp = (arr.length - 1) - idx

		if(section.replaceAll('0','') === ''){
			return result
		}

		if(section.length === 1){
			result += DIGITS_TO_WORDS[section as keyof typeof DIGITS_TO_WORDS]
		}else if(section.length === 2){
			const sectionAsInt = parseInt(section)
			if(sectionAsInt > 20){
				result += DIGITS_TO_WORDS[section[0] + "0" as keyof typeof DIGITS_TO_WORDS] + " " + DIGITS_TO_WORDS[section[1] as keyof typeof DIGITS_TO_WORDS]
			}
			else
			{
				result += DIGITS_TO_WORDS[section as keyof typeof DIGITS_TO_WORDS]
			}
		}
		else
		{

			const firstIsZero = section[0] === "0"

			if(!firstIsZero){
				result += DIGITS_TO_WORDS[section[0] as keyof typeof DIGITS_TO_WORDS] + " " + DIGITS_TO_WORDS_EXPONENTS[1e2]
			}



			
			if(section[1] === "0"){
				if(section[2] !== "0"){
					result += (firstIsZero ? "" : " and ") + DIGITS_TO_WORDS[section[2] as keyof typeof DIGITS_TO_WORDS]
				}
			}
			else
			{
				const subSectionAsInt = parseInt(section.slice(1))
				if(subSectionAsInt > 20){
					result += (firstIsZero ? "" : " and ") + DIGITS_TO_WORDS[section[1] + "0" as keyof typeof DIGITS_TO_WORDS] + " " + DIGITS_TO_WORDS[section[2] as keyof typeof DIGITS_TO_WORDS]
				}
				else
				{
					result += (firstIsZero ? "" : " and ") + DIGITS_TO_WORDS[section.slice(1) as keyof typeof DIGITS_TO_WORDS]
				}
			}
		}

		const exponent = Math.pow(10,exp * 3)
		if(exponent > 1){
			result += " " + DIGITS_TO_WORDS_EXPONENTS[exponent as keyof typeof DIGITS_TO_WORDS_EXPONENTS]
		}

		return result + " "
	},"").trim() + decimals

}

export function digitsToWords(digits: string) {
	let result = ""

	for(const token of Array.from(digits.matchAll(SPLIT_TEXT_REGEX))){
		const current = token[0]
		if(DIGITS_REGEX.test(current)){
			result += digitToWord(current)
		}
		else
		{
			result += current
		}
	}

	return result
}


