import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import type { Linter } from "eslint";
import agentic from "./src/index.js";

// This package lints itself with its own rules where they apply. A plugin that
// does not dogfood is a plugin nobody has run.
//
// This config is TypeScript and imports `./src/index.ts` DIRECTLY, not the
// compiled `dist/`. That is load-bearing: it keeps `eslint .` working on a clean
// checkout with no build step, which is the property the old "no build step, on
// purpose" note existed to protect. Pointing it at `dist/` would make linting
// depend on a prior build.
const config: Linter.Config[] = [
  { ignores: ["node_modules/**", "coverage/**", "dist/**"] },
  {
    files: ["**/*.ts"],
    ...js.configs.recommended,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { console: "readonly", process: "readonly" },
    },
    rules: {
      ...js.configs.recommended.rules,
      // TypeScript resolves every identifier itself; espree's no-undef reports
      // type-only names it cannot see.
      "no-undef": "off",
      "no-unused-vars": "off",
    },
    plugins: { agentic: agentic as unknown as NonNullable<Linter.Config["plugins"]>[string] },
  },
  {
    files: ["**/*.ts"],
    plugins: { agentic: agentic as unknown as NonNullable<Linter.Config["plugins"]>[string] },
    rules: { "agentic/no-credential-in-url": "error" },
  },
  {
    // Test files are FIXTURES: `no-credential-in-url`'s invalid cases are, by
    // construction, credentials in URLs. Linting them means the rule reports
    // its own test suite.
    files: ["tests/**/*.ts"],
    rules: { "agentic/no-credential-in-url": "off" },
  },
  {
    // Rule modules are `meta` + `create` objects — a default export is the
    // plugin API's shape, not a style choice — so the one-export convention is
    // measured on the helpers around them, not on the export itself.
    // `breakpoint-guard` and `define-rule` are deliberately multi-export shared
    // modules.
    files: ["src/rules/**/*.ts", "src/breakpoint-guard.ts", "src/define-rule.ts"],
    rules: { "agentic/one-export-per-file": "off" },
  },
];

export default config;
