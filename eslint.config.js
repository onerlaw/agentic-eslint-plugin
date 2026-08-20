import js from "@eslint/js";
import agentic from "./src/index.js";

// This package lints itself with its own rules where they apply. A plugin that
// does not dogfood is a plugin nobody has run.
export default [
  { ignores: ["node_modules/**", "coverage/**"] },
  {
    files: ["**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { console: "readonly", process: "readonly" },
    },
    plugins: { agentic },
    rules: {
      "agentic/no-credential-in-url": "error",
    },
  },
  {
    // Test files are FIXTURES: `no-credential-in-url`'s invalid cases are, by
    // construction, credentials in URLs. Linting them means the rule reports
    // its own test suite.
    files: ["tests/**/*.js"],
    plugins: { agentic },
    rules: { "agentic/no-credential-in-url": "off" },
  },
  {
    // Rule modules are `meta` + `create` objects — a default export is the
    // plugin API's shape, not a style choice — so the one-export convention is
    // measured on the helpers around them, not on the export itself.
    files: ["src/rules/**/*.js", "src/breakpoint-guard.js"],
    plugins: { agentic },
    rules: {
      "agentic/one-export-per-file": "off",
    },
  },
];
