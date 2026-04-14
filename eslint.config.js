// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    languageOptions: {
      globals: {
        // Node globals you commonly need
        process: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
        console: "readonly",
        // Jest globals
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
      },
    },
  },
]);
