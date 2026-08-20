# `rpc-error-standard`

Enforce a single RPC error-handling standard: feature code never hand-classifies RPC failures.

> **Requires options.** See [Options](#options).

## Why

Every RPC or network failure should route through **one** error module. Left alone,
per-feature classification breeds divergent catch blocks — dozens of them, each deciding
for itself what a given status code means, drifting apart as they are copied. Unifying
that is cheap once; keeping it unified is what this guard is for.

## Predicate 1 matches by name, from any specifier — and that is the whole point

A path-keyed check such as `no-restricted-imports` pointed at your RPC client package is
defeated completely by a re-export barrel: every violation that reaches the banned symbol
through a local barrel disappears from the report while the report looks clean. Matching
by **imported name, from any module path**, is why this cannot be stock config.

## The four predicates

1. Value imports of the banned classification symbols (default `Code`, `ConnectError`), from any path.
2. A namespace import of the RPC client package.
3. An import of the configured consent-helper name from outside the error module.
4. A raw configured sentinel string literal.

Predicates **3 and 4 are dark by default** — `consentHelper` unset and `sentinels: []` —
because they encode project-specific literals with no generic analogue. Predicates 1 and
2 carry defaults and are always live. Do not read an unconfigured predicate as a passing
one; this page is the record of which are inactive until you configure them.

## What it catches

```ts
// ✗ value imports of the classification symbols, from anywhere
import { Code, ConnectError } from "@connectrpc/connect";
import { Code } from "@/lib/vendor-barrel"; // a barrel does not hide it

// ✗ namespace import of the client package
import * as connect from "@connectrpc/connect";

// ✓ type-only references cannot hand-classify anything at runtime
import type { PromiseClient } from "@connectrpc/connect";

// ✓ the sanctioned path
import { handleRpcError } from "@/lib/errors";
```

## Options

| Option | Type | Required | Meaning |
|---|---|---|---|
| `errorModule` | `string` | **yes** | Path segment of the standard's own home. Exempted, and named in the advice text. |
| `package` | `string` | no (`"@connectrpc/connect"`) | The RPC client package. |
| `bannedSpecifiers` | `string[]` | no (`["Code","ConnectError"]`) | Imported names that constitute hand-classification. |
| `sentinels` | `string[]` | no (`[]`) | Raw sentinel string literals to ban. |
| `consentHelper` | `string` | no (unset) | A helper name that must not be imported outside the error module. |
| `extraExemptPathSegments` | `string[]` | no (`[]`) | Additional exempt path segments. |

### Why `errorModule` is required rather than defaulted empty

The exemption is a **correctness carve-out, not a tuning knob**. The module implementing
the standard must be allowed to touch the APIs the rule bans everywhere else. Default it
to `[]` and the rule reports the very code that discharges it.

## Known blind spots

1. A renamed re-export (`export { Code as Foo }` elsewhere, then importing `Foo`) defeats
   name matching. Accepted residual.
2. A dynamic `import()` or a computed member access is not seen.
3. The sentinel predicate compares AST literal values, so a concatenated or templated
   construction of the same string is invisible — and, deliberately, so is the sentinel
   inside a **comment**. A comment naming the sentinel is documentation, not a
   hand-classification; a raw text scan flags it, and that is noise.

## Config

Test files (`*.test.*`) are exempt inside the rule, alongside `errorModule`.

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { agentic },
    rules: {
      "agentic/rpc-error-standard": ["error", { errorModule: "/src/lib/errors/" }],
    },
  },
];
```
