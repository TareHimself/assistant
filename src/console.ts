import path from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { inspect } from 'util';

const defaultConsoleLog = console.info;

const defaultConsoleWarn = console.warn;

const defaultConsoleError = console.error;

export const enum ELogType {
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
}

export function getStack(offset = 3) {
	const err = new Error();
	return err.stack?.split('\n').slice(offset) || [];
}
export function getLogFileName() {
	const stack = getStack(4)[0].slice(0, -1).split(path.sep);
	return stack[stack.length - 1];
}

export const LOG_DEFAULTS = {
	TYPE_LENGTH: 5,
	FILENAME_LENGTH: 25,
};

const LOGS_PATH = path.join(process.cwd(), 'logs');

if (!existsSync(LOGS_PATH)) {
	mkdirSync(LOGS_PATH);
}

const LOG_FILE_PATH = path.join(
	LOGS_PATH,
	new Date()
		.toISOString()
		.replace('T', ' ')
		.replace('Z', '')
		.replaceAll(':', '-')
		.replaceAll('.', '-')
		.replaceAll(' ', '-')
);

const LOG_FILE_STREAM = createWriteStream(LOG_FILE_PATH);

export function getLogTime() {
	return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export function logArgsToString(...args: any[]) {
	return args
		.reduce<string>((final, a) => {
			if (typeof a === 'object') {
				return final + `${inspect(a)} `;
			}

			return final + `${a} `;
		}, '')
		.trimEnd();
}

export function customConsoleInfo(...args: any[]) {
	const timestamp = getLogTime();
	const filename = getLogFileName().padEnd(LOG_DEFAULTS.FILENAME_LENGTH);

	defaultConsoleLog(
		timestamp,
		'|',
		ELogType.INFO.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
		'|',
		filename,
		'|',
		...args
	);

	LOG_FILE_STREAM.write(
		logArgsToString(
			timestamp,
			'|',
			ELogType.INFO.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
			'|',
			filename,
			'|',
			...args
		) + '\n'
	);
}

export function customConsoleWarn(...args: any[]) {
	const timestamp = getLogTime();
	const filename = getLogFileName().padEnd(LOG_DEFAULTS.FILENAME_LENGTH);

	defaultConsoleWarn(
		timestamp,
		'|',
		ELogType.WARN.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
		'|',
		filename,
		'|',
		...args
	);

	LOG_FILE_STREAM.write(
		logArgsToString(
			timestamp,
			'|',
			ELogType.WARN.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
			'|',
			filename,
			'|',
			...args
		) + '\n'
	);
}

export function customConsoleError(...args: any[]) {
	const timestamp = getLogTime();
	const filename = getLogFileName().padEnd(LOG_DEFAULTS.FILENAME_LENGTH);

	defaultConsoleError(
		timestamp,
		'|',
		ELogType.ERROR.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
		'|',
		filename,
		'|',
		...args.map((a) => (a.isAxiosError ? a.message : a))
	);

	LOG_FILE_STREAM.write(
		logArgsToString(
			timestamp,
			'|',
			ELogType.ERROR.padEnd(LOG_DEFAULTS.TYPE_LENGTH),
			'|',
			filename,
			'|',
			...args
		) + '\n'
	);
}

console.info = customConsoleInfo;

console.warn = customConsoleWarn;

console.error = customConsoleError;
