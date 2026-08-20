# `one-export-per-file`

Enforce one exported function per file.

## Why

A convention: one exported function per file, with the filename matching it
(`list-jobs.ts` → `listJobs`). Colocating several exported functions makes the filename
stop predicting the export, and hides where a symbol lives.

## The predicate is "exported functions", and that choice is load-bearing

This rule replaced a bespoke script that counted *any* top-level function or class
definition — exported **or private**. That is strictly stricter than the convention it
claimed to enforce, so every file with one export plus private helpers had to buy an
allowlist entry despite fully satisfying the rule.

That mismatch was the entire reason the allowlist had grown to 240 entries. Correcting
the predicate dropped **213 of them** — they had never been violations — and at the same
time surfaced **3 real violations** the script was blind to, each a file exporting two
functions where one is a type-annotated arrow const
(`export const isIgnored: (…) => boolean = …`), a shape its regex did not count as a
definition.

The lesson generalises: a long exemption list is often evidence the *check* is wrong,
not the code. Measure why each entry exists before concluding the convention is
mis-shaped.

Counting *all* exports rather than just functions was measured and rejected — it flags
pure data modules, which the convention never meant to forbid.

## What it catches

```ts
// ✗ two exported functions
export function parse(s: string) {}
export function format(v: number) {}

// ✓ one export, private helpers co-locate freely
function normalise(s: string) {}
export function parse(s: string) {
  return normalise(s);
}

// ✓ data, types and interfaces are not functions
export const LIMIT = 20;
export type Options = { limit: number };
```

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `allow` | `string[]` | `[]` | Path suffixes exempted from the rule. |

```js
{ "agentic/one-export-per-file": ["error", { allow: ["src/lib/errors/index.ts"] }] }
```

## Known blind spots

1. `export const x = cond ? fnA : fnB` exports a function this cannot see statically —
   the initialiser is a conditional, not a function node.
2. A re-export (`export { a } from "./x"`) is not counted, since the function lives in
   another file, so a barrel is never a violation. A **local** export list
   (`export { a, b }`) *is* counted, by resolving each specifier to its binding.
   Conflating those two shapes is an easy mistake that silently lets local lists through.
3. Scope comes entirely from the config block's `files`/`ignores`. Framework directories
   that require a default export per file (a file-based router, for instance) belong in
   `ignores`, not in `allow`.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/**", "**/index.ts", "**/*.test.ts"],
    plugins: { agentic },
    rules: { "agentic/one-export-per-file": "error" },
  },
];
```
