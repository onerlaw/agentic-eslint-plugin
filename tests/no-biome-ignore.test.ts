import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/no-biome-ignore.js";

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

ruleTester.run("no-biome-ignore", rule, {
  valid: [
    { name: "no suppression", code: "export const a = 1;" },
    { name: "an ordinary comment", code: "// this is fine\nexport const a = 1;" },
    {
      name: "an eslint-disable is a different tool's concern",
      code: "// eslint-disable-next-line\nexport const a = 1;",
    },
  ],
  invalid: [
    {
      name: "line-comment biome-ignore",
      code: "// biome-ignore lint/suspicious/noExplicitAny: because\nexport const a = 1;",
      errors: [{ messageId: "inlineSuppression" }],
    },
    {
      name: "block-comment biome-ignore",
      code: "/* biome-ignore lint/style/noDefaultExport: because */\nexport const a = 1;",
      errors: [{ messageId: "inlineSuppression" }],
    },
    {
      name: "two directives report twice",
      code: "// biome-ignore lint/a: x\nconst a = 1;\n// biome-ignore lint/b: y\nexport const b = a;",
      errors: [{ messageId: "inlineSuppression" }, { messageId: "inlineSuppression" }],
    },
  ],
});
