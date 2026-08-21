import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/one-export-per-file.js";

const F = "packages/server/src/services/probe.ts";
const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run("one-export-per-file", rule, {
  valid: [
    { name: "one exported function", filename: F, code: "export function a() { return 1; }" },
    { name: "one exported arrow const", filename: F, code: "export const a = () => 1;" },
    {
      // THE CORRECTION. The replaced script counted private definitions too, so
      // this shape had to buy an allowlist entry despite satisfying the rule.
      // 213 of 240 entries existed for exactly this.
      name: "one export plus PRIVATE helpers",
      filename: F,
      code: "function h1() { return 1; }\nfunction h2() { return 2; }\nexport function a() { return h1() + h2(); }",
    },
    {
      name: "data consts are not functions",
      filename: F,
      code: "export const MAX = 3;\nexport const NAME = 'x';\nexport function a() { return MAX; }",
    },
    {
      // Why counting ALL exports was measured and rejected: it flags pure data
      // modules like api/src/constants.ts, which the convention never forbade.
      name: "a pure data module",
      filename: F,
      code: "export const A = 1;\nexport const B = 2;\nexport const C = 3;",
    },
    {
      name: "types and interfaces do not count",
      filename: F,
      code: "export type T = string;\nexport interface I { a: string }\nexport function a() { return 1; }",
    },
    {
      name: "a re-export barrel is not a definition",
      filename: F,
      code: "export { a } from './a';\nexport { b } from './b';",
    },
    {
      name: "allowlisted file",
      filename: "packages/server/src/services/allowed.ts",
      options: [{ allow: ["/services/allowed.ts"] }],
      code: "export function a() { return 1; }\nexport function b() { return 2; }",
    },
  ],

  invalid: [
    {
      name: "two exported function declarations",
      filename: F,
      code: "export function a() { return 1; }\nexport function b() { return 2; }",
      errors: [{ messageId: "tooMany" }],
    },
    {
      // THE SHAPE THE REPLACED SCRIPT WAS BLIND TO — its regex did not count a
      // type-annotated arrow const as a definition. All 3 newly-surfaced
      // violations in the live tree are exactly this.
      name: "an exported function plus a type-annotated arrow const",
      filename: F,
      code: "export function a() { return 1; }\nexport const b: (x: number) => number = (x) => x;",
      errors: [{ messageId: "tooMany" }],
    },
    {
      name: "an exported class alongside a function",
      filename: F,
      code: "export class A {}\nexport function b() { return 1; }",
      errors: [{ messageId: "tooMany" }],
    },
    {
      name: "a default-exported function alongside a named one",
      filename: F,
      code: "export default function a() { return 1; }\nexport function b() { return 2; }",
      errors: [{ messageId: "tooMany" }],
    },
  ],
});

// REGRESSION PIN for the local-vs-re-export conflation. The first cut of this
// rule early-returned on any ExportNamedDeclaration without an inline
// declaration, so a local `export { a, b }` list silently passed while the
// blind-spot list claimed parity with the replaced script.
new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
}).run("one-export-per-file (local export lists)", rule, {
  valid: [
    {
      name: "a local export list of DATA consts is not functions",
      filename: F,
      code: "const A = 1;\nconst B = 2;\nexport { A, B };",
    },
    {
      name: "a local export list naming ONE function",
      filename: F,
      code: "function a() { return 1; }\nconst B = 2;\nexport { a, B };",
    },
  ],
  invalid: [
    {
      name: "a local export list naming TWO functions",
      filename: F,
      code: "function a() { return 1; }\nfunction b() { return 2; }\nexport { a, b };",
      errors: [{ messageId: "tooMany" }],
    },
    {
      name: "a local export list of two arrow consts",
      filename: F,
      code: "const a = () => 1;\nconst b = () => 2;\nexport { a, b };",
      errors: [{ messageId: "tooMany" }],
    },
  ],
});
