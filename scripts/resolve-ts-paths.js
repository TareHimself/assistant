const fs = require('fs');
const path = require('path');

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
const PATHS = [];
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

async function getAllFilesInDir(start) {
	const localDirectories = await fs.promises.readdir(start);
	const allDirectories = [...localDirectories];
	for (let i = 0; i < localDirectories.length; i++) {
		const filePath = path.join(start, localDirectories[i]);
		const stat = await fs.promises.lstat(filePath);
		if (stat.isDirectory()) {
			allDirectories.push(...(await getAllFilesInDir(filePath)));
		}
		allDirectories[i] = filePath;
	}

	return allDirectories;
}

getAllFilesInDir('./dist').then(async (a) => {
	await Promise.all(
		a.map((dir) => {
			return new Promise(async (res) => {
				if (dir === path.join('./dist', 'resolver.js')) {
					return;
				}

				const lines = (await fs.promises.readFile(dir, 'ascii')).split('\n');
				console.log(dir, lines);
			});
		})
	);
});
