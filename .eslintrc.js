module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "prettier"],
  requireConfigFile: false,
  parserOptions: {
    ecmaVersion: "latest",
  },
  parser: "@babel/eslint-parser",
  rules: {
    "global-require": "off",
    "import/no-dynamic-require": "off",
    indent: ["error", "tab"],
    quotes: ["error", "single"],
    semi: ["error", "always"],
  },
};
