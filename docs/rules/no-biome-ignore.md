# `no-biome-ignore`

Ban inline `biome-ignore` suppression comments.

## Why

A suppression comment hides a finding from everyone downstream and carries no
obligation to explain itself. The sanctioned escape is a per-file override in
`biome.json`, which shows up in a diff and forces the exemption to be named. An inline
directive is neither reviewable nor named.

No stock rule covers this: `biome-ignore` is a Biome directive and ESLint has no concept
of it. (The `@ts-expect-error` analogue is handled by `@typescript-eslint/ban-ts-comment`;
this has no such counterpart.)

## What it catches

```js
// ✗
// biome-ignore lint/suspicious/noExplicitAny: legacy
const x = something;

/* ✗ */
/* biome-ignore lint/style/noDefaultExport: plugin API */

// ✓ — a different tool's directive
// eslint-disable-next-line no-console
```

## Options

None, by design. There is no legitimate inline use — the override path exists precisely
so the exemption lands somewhere a reviewer sees it. Do not add an escape hatch.

## Known blind spots

1. It matches the substring `biome-ignore` anywhere in a comment, so prose *about* the
   directive is flagged too. Accepted: documentation of the ban belongs in files this
   rule does not lint.
2. A directive constructed at runtime is not a comment and is invisible. Meaningless in
   practice — Biome reads source text.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: { agentic },
    rules: { "agentic/no-biome-ignore": "error" },
  },
];
```
