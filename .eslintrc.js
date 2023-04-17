module.exports = {
	env: {
		browser: true,
		commonjs: true,
		es2021: true,
	},
	extends: ['eslint:recommended', 'prettier'],

	parserOptions: {
		ecmaVersion: 'latest',
		requireConfigFile: false,
	},
	parser: '@babel/eslint-parser',
	rules: {
		'global-require': 'off',
		'import/no-dynamic-require': 'off',
		indent: ['error', 'tab'],
		quotes: ['error', 'single'],
		semi: ['error', 'always'],
	},
};
