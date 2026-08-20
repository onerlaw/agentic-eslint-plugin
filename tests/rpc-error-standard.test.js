import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/rpc-error-standard.js";

// This rule needs no filesystem, so relative filenames are fine — but they must
// still express the two exemptions (src/lib/ and *.test.*), which are path-shaped.
const FEATURE = "packages/web/src/components/screens/jobs/use-jobs.ts";
const OPTIONS = [{ errorModule: "/src/lib/", sentinels: ["consent_required"], consentHelper: "isAuthError" }];

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run("rpc-error-standard", rule, {
  valid: [
    {
      options: OPTIONS,
      name: "the sanctioned entry point",
      filename: FEATURE,
      code: 'import { handleRpcError } from "@/lib/errors/handle-rpc-error";\nexport const a = handleRpcError;',
    },
    {
      options: OPTIONS,
      name: "type-only import of a banned name binds no value",
      filename: FEATURE,
      code: 'import type { ConnectError } from "@connectrpc/connect";\nexport type T = ConnectError;',
    },
    {
      options: OPTIONS,
      name: "inline type specifier binds no value",
      filename: FEATURE,
      code: 'import { type Code } from "@connectrpc/connect";\nexport type T = Code;',
    },
    {
      options: OPTIONS,
      name: "a non-banned value import from the same package",
      filename: FEATURE,
      code: 'import { createClient } from "@connectrpc/connect";\nexport const a = createClient;',
    },
    {
      options: OPTIONS,
      name: "src/lib/ is the standard's own home — exempt",
      filename: "packages/web/src/lib/errors/classify-rpc-error.ts",
      code: 'import { Code, ConnectError } from "@connectrpc/connect";\nexport const a = [Code, ConnectError];',
    },
    {
      options: OPTIONS,
      name: "src/lib/ may own the sentinel literal",
      filename: "packages/web/src/lib/consent.ts",
      code: 'export const SENTINEL = "consent_required";',
    },
    {
      options: OPTIONS,
      name: "test files construct wire errors deliberately — exempt",
      filename: "packages/web/src/components/screens/jobs/use-jobs.test.ts",
      code: 'import { ConnectError } from "@connectrpc/connect";\nexport const a = ConnectError;',
    },
  ],

  invalid: [
    {
      options: OPTIONS,
      // PREDICATE 1, canonical path.
      name: "value import of Code from the canonical package",
      filename: FEATURE,
      code: 'import { Code } from "@connectrpc/connect";\nexport const a = Code;',
      errors: [{ messageId: "bannedImport" }],
    },
    {
      options: OPTIONS,
      // PREDICATE 1, THE knowledge-163 case — a re-export barrel. A path-keyed
      // rule would miss this entirely; that channel once hid ~27 violations.
      name: "value import of ConnectError laundered through a local barrel",
      filename: FEATURE,
      code: 'import { ConnectError } from "@/lib/connect-client";\nexport const a = ConnectError;',
      errors: [{ messageId: "bannedImport" }],
    },
    {
      options: OPTIONS,
      name: "value import of Code laundered through a relative re-export",
      filename: FEATURE,
      code: 'import { Code } from "./errors";\nexport const a = Code;',
      errors: [{ messageId: "bannedImport" }],
    },
    {
      options: OPTIONS,
      name: "both banned names in one statement report twice",
      filename: FEATURE,
      code: 'import { Code, ConnectError } from "@connectrpc/connect";\nexport const a = [Code, ConnectError];',
      errors: [{ messageId: "bannedImport" }, { messageId: "bannedImport" }],
    },
    {
      options: OPTIONS,
      // PREDICATE 2.
      name: "namespace import of the connect package",
      filename: FEATURE,
      code: 'import * as connect from "@connectrpc/connect";\nexport const a = connect;',
      errors: [{ messageId: "namespaceImport" }],
    },
    {
      options: OPTIONS,
      // PREDICATE 3.
      name: "isAuthError imported outside src/lib/",
      filename: FEATURE,
      code: 'import { isAuthError } from "@/lib/consent";\nexport const a = isAuthError;',
      errors: [{ messageId: "consentHelper" }],
    },
    {
      options: OPTIONS,
      // PREDICATE 4 — the one that is not an import check at all. Naming this
      // rule `-imports` is exactly how it would have been dropped.
      name: "raw sentinel literal outside src/lib/",
      filename: FEATURE,
      code: 'export const a = err.message === "consent_required";',
      errors: [{ messageId: "sentinel" }],
    },
    {
      options: OPTIONS,
      name: "sentinel as a bare template literal",
      filename: FEATURE,
      code: "export const a = `consent_required`;",
      errors: [{ messageId: "sentinel" }],
    },
  ],
});
