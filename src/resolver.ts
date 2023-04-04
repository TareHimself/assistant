import * as fs from 'fs';
import path from 'path';
import Module from 'module';

const WORKING_DIRECTORY = process.cwd();

const COMMENTS_REGEX = new RegExp(/\/\/.*/gm);

const tsConfig = JSON.parse(
	fs
		.readFileSync(path.join(WORKING_DIRECTORY, 'tsconfig.json'), {
			encoding: 'ascii',
		})
		.replaceAll(COMMENTS_REGEX, '')
);
const BASE_URL = tsConfig['compilerOptions']['outDir'];
const PATHS: string[] = [];
const PATH_DICT = {};
Object.keys(tsConfig['compilerOptions']['paths']).forEach((p) => {
	const key = p.slice(0, -2);
	PATHS.push(key);
	PATH_DICT[key] = path.join(
		WORKING_DIRECTORY,
		BASE_URL,
		tsConfig['compilerOptions']['paths'][p][0].slice(0, -2)
	);
});

const originalLoader = (Module as any)._load;

function convertPath(original: string) {
	const targetPath = PATHS.find((p) => {
		return original.startsWith(p);
	});

	if (targetPath) {
		return path.join(PATH_DICT[targetPath], original.slice(targetPath.length));
	}

	return original;
}

(Module as any)._load = (request: string, parent: NodeJS.Module) => {
	return originalLoader(convertPath(request), parent);
};
