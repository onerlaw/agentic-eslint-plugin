# `workspace-runtime-imports`

Ban runtime imports of workspace packages the nearest `package.json` does not declare.

> **Requires options.** See [Options](#options).

## Why

A monorepo web bundle is often produced by a job that runs only on merge: `npm ci` plus
a bundler export, with no `turbo build` / `tsc -b` first — so no workspace package's
`dist/` exists on that runner. A runtime import of an **undeclared** workspace package
therefore resolves fine under Node (local dev, CI lint, typecheck and tests, all of
which pre-build the dist) and fails **only** in the production build.

That asymmetry is the whole hazard: every gate you have says green, and the failure
lands in production. It is worth an hour of outage exactly once to learn.

This is **not** delegable to `import/no-extraneous-dependencies`, which treats workspace
packages as exempt — precisely and only the category this guard covers. Adopting it
would report success on the real failure.

## What it catches

Given a `package.json` declaring `@acme/config` but not `@acme/database`:

```ts
// ✗ runtime edge to an undeclared workspace package
import { db } from "@acme/database";
const m = await import("@acme/database");
const legacy = require("@acme/database");
export { thing } from "@acme/database";

// ✓ type-only edges are erased by the TS transform
import type { Row } from "@acme/database";

// ✓ declared
import { load } from "@acme/config";
```

Subpaths resolve through the same package entry, so `@acme/database/schema` is checked
against `@acme/database`.

## Options

| Option | Type | Required | Meaning |
|---|---|---|---|
| `scopes` | `string[]` | **yes** | Package-name prefixes treated as workspace packages, e.g. `["@acme/"]`. |

The rule cannot work without this, so the schema requires it — enabling the rule with no
options is a config error, not a silent no-op.

## Known blind spots

1. A statement-level value import whose specifiers are all inline-`type`
   (`import { type A } from "@acme/pkg"`) is still flagged, because whether the transform
   elides such a statement depends on compiler options. Treating it as an edge is the
   safe side.
2. A dynamic `import()` with a static string is covered. Only a **computed** specifier
   (`import(someVar)`) is invisible — there is no static string to resolve.
3. A malformed `package.json` degrades to "nothing is declared", which flags *more*
   rather than less. Deliberate: a guard must not take down the lint run with a stack
   trace, and over-reporting is the safe direction.

## Config

Test files are exempt in three forms, handled inside the rule: `.test.`, `.spec.`, and
any path under `__tests__/`.

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["packages/web/src/**/*.{ts,tsx}"],
    plugins: { agentic },
    rules: {
      "agentic/workspace-runtime-imports": ["error", { scopes: ["@acme/"] }],
    },
  },
];
```
