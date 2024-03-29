import { BrowserWindow } from 'electron';
import path from 'path';
import { createInterface } from 'readline';
import { compareTwoStrings } from 'string-similarity';
import { Awaitable } from './types';

export function pad(number: number, ammount = 5) {
	let start = `${number}`;

	const needed = Math.max(ammount - start.length, 0);

	for (let i = 0; i < needed; i++) {
		start = `0${start}`;
	}

	return start;
}

export function isNumeric(value: string) {
	return /^-?\d+$/.test(value);
}

export function input<T = string>(
	prompt: string,
	toResultFn: (input: string) => Promise<T>,
	validateFn: (input: string) => Promise<boolean> = async () => true
): Promise<T> {
	return new Promise<T>(async (resolve, reject) => {
		const questionInterface = createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		try {
			let result: T | null = null;

			do {
				const response = await new Promise<string>((res) => {
					questionInterface.question(prompt, (response) => {
						res(response);
					});
				});

				if (await validateFn(response)) {
					result = await toResultFn(response);
				}
			} while (result === null);

			resolve(result);
		} catch (error) {
			reject(error);
		}
		questionInterface.close();
	});
}

export function delay(length: number) {
	return new Promise<void>((res) => {
		setTimeout(res, length);
	});
}

export function mostLikelyOption<T extends string>(
	selection: string,
	options: T[]
): T {
	return options.reduce<[T, number]>(
		(final, current) => {
			const similarity = compareTwoStrings(current, selection);
			if (similarity > final[1]) {
				return [current, similarity];
			}

			return final;
		},
		[options[0], 0]
	)[0];
}

export async function executeInBrowserWindow<
	T extends (...args: unknown[]) => unknown,
	R extends T extends (...args: unknown[]) => infer I ? Awaited<I> : unknown
>(func: T, target: BrowserWindow, ...args: Parameters<T>): Promise<R> {
	return await target.webContents.executeJavaScript(
		`(${func.toString()})(${args.join(',')})`
	);
}
