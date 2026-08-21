import path from "node:path";
import { fileURLToPath } from "node:url";
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/workspace-runtime-imports.js";

// Filenames MUST be absolute: the rule walks up for the nearest package.json,
// and a relative filename resolves against the test process CWD, so every
// lookup would hit this package's own manifest and silently invert every case.
const HERE = path.dirname(fileURLToPath(import.meta.url));

// tests/fixtures/app declares @acme/config and @acme/contract but NOT
// @acme/database — the undeclared-runtime-import shape this rule exists to
// catch. A real manifest on disk, because the walk is real.
const FRONTEND = path.join(HERE, "fixtures", "app", "src", "probe.tsx");

const OPTIONS = [{ scopes: ["@acme/"] }];

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("workspace-runtime-imports", rule, {
  valid: [
    {
      name: "declared workspace package",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { getConfig } from "@acme/config";\nexport const a = getConfig;',
    },
    {
      name: "declared package via a subpath",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { x } from "@acme/contract/foo";\nexport const a = x;',
    },
    {
      name: "import type of an UNdeclared package — erased, no module edge",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import type { GenerationPhase } from "@acme/database";\nexport type T = GenerationPhase;',
    },
    {
      name: "export type of an undeclared package",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'export type { GenerationPhase } from "@acme/database";',
    },
    {
      // The residual half of blind spot 2: a COMPUTED specifier has no static
      // string to resolve, so it is genuinely invisible. Pinned so the boundary
      // between "covered" and "invisible" is asserted, not assumed.
      name: "dynamic import() with a COMPUTED specifier is invisible",
      filename: FRONTEND,
      options: OPTIONS,
      code: "export const load = async (m) => (await import(m)).x;",
    },
    {
      name: "non-workspace package is out of scope",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { sql } from "drizzle-orm";\nexport const a = sql;',
    },
    // The three test-exemption forms. The replaced script exempted all three;
    // a suffix-only exemption would silently un-exempt the __tests__ case.
    {
      name: "exempt: .test. suffix",
      filename: path.join(HERE, "fixtures", "app", "src", "probe.test.ts"),
      options: OPTIONS,
      code: 'import { V } from "@acme/database";\nexport const a = V;',
    },
    {
      name: "exempt: .spec. suffix",
      filename: path.join(HERE, "fixtures", "app", "src", "probe.spec.ts"),
      options: OPTIONS,
      code: 'import { V } from "@acme/database";\nexport const a = V;',
    },
    {
      name: "exempt: under __tests__/ with NO suffix",
      filename: path.join(HERE, "fixtures", "app", "src", "__tests__", "helper.ts"),
      options: OPTIONS,
      code: 'import { V } from "@acme/database";\nexport const a = V;',
    },
  ],

  invalid: [
    {
      // THE REPRODUCTION TARGET — the shape that shipped and broke the web build.
      name: "value import of an undeclared workspace package",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { GENERATION_PHASE_VALUES } from "@acme/database";\nexport const a = GENERATION_PHASE_VALUES;',
      errors: [{ messageId: "undeclared" }],
    },
    {
      name: "undeclared package via a subpath, normalised to the base name",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { x } from "@acme/database/schema";\nexport const a = x;',
      errors: [{ messageId: "undeclared" }],
    },
    {
      name: "re-export is a value edge too",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'export { GENERATION_PHASE_VALUES } from "@acme/database";',
      errors: [{ messageId: "undeclared" }],
    },
    {
      name: "export * is a value edge",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'export * from "@acme/database";',
      errors: [{ messageId: "undeclared" }],
    },
    {
      name: "require() is a value edge",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'const db = require("@acme/database");\nexport const a = db;',
      errors: [{ messageId: "undeclared" }],
    },
    {
      // REGRESSION PIN. The first cut of this rule had no ImportExpression
      // handler, so this case — which the replaced script's text scan DID catch
      // as a value edge — was silently dropped, while the blind-spot doc claimed
      // parity. Completion verification caught it; this case is what stops a
      // future refactor reintroducing it with nothing in CI to notice.
      name: "dynamic import() with a static specifier is a runtime edge",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'export const load = async () => (await import("@acme/database")).x;',
      errors: [{ messageId: "undeclared" }],
    },
    {
      // Documented blind spot 1, asserted so the behaviour is pinned rather than
      // accidental: an all-inline-type statement is still treated as an edge.
      name: "all-inline-type specifiers still flagged (matches the replaced script)",
      filename: FRONTEND,
      options: OPTIONS,
      code: 'import { type GenerationPhase } from "@acme/database";\nexport type T = GenerationPhase;',
      errors: [{ messageId: "undeclared" }],
    },
  ],
});
