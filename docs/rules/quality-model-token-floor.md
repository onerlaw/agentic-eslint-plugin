# `quality-model-token-floor`

Ban any token cap other than the named floor constant at a reasoning-tier LLM call site.

> **Requires options.** See [Options](#options).

## Why

A reasoning model counts its internal thinking tokens against the **same** budget as its
output. A cap sized for the reply alone is fully consumed before any output or forced
tool call emits, and the request returns `finish_reason: "length"` with a truncated body
or zero tool calls.

The fix is a single named floor constant, high enough to cover thinking, applied at every
such call site. Reply length is governed by the prompt, not by the cap — **a cap is not a
spend limit**.

## Why mechanize it

Nothing else can see it. A type-checker sees a valid number, a formatter sees a valid
property, and no unit test observes a live `finish_reason`. The failure surfaces only in
production logs, after a user hits it.

And it recurs: each occurrence gets fixed at its own call site, and none of those fixes
can see the next one coming. A defect that ships repeatedly, that no existing gate can
observe, and whose guard is cheap, is the textbook case for a lint rule.

## What it catches

In a file that calls the configured reasoning-tier function:

```ts
// ✗ inline literal
const res = await client.chat({ model: getQualityModel(), max_tokens: 4000 });

// ✗ local const bound to a number — the spelling this actually takes in the wild
const ANSWER_MAX_TOKENS = 700;
const res = await client.chat({ model: getQualityModel(), max_tokens: ANSWER_MAX_TOKENS });

// ✓
const res = await client.chat({ model: getQualityModel(), max_tokens: TOKEN_FLOOR });
```

One level of local indirection is resolved, and that matters more than it looks: a rule
banning only inline numeric literals would pass the very files it exists for, because the
real-world shape is a named local constant.

## Options

| Option | Type | Required | Meaning |
|---|---|---|---|
| `tierFunction` | `string` | **yes** | Function name whose presence marks a file as reasoning-tier. |
| `floorIdentifier` | `string` | **yes** | The one identifier allowed as the cap. |
| `capProperty` | `string` | no (`"max_tokens"`) | The object key holding the cap. |

## Polarity and bias

Errs toward **false positives** on locally-declared caps: any local const bound to a
number and used as the cap in a tier file is reported, even if the author believed the
number was safe. That is deliberate — "this one is small enough" is precisely the
reasoning that ships the bug.

## Known blind spots

1. An identifier **imported** from another module is allowed, because a single-file rule
   cannot resolve the binding. An alias bound to a literal in another file therefore
   passes. Requiring the bare floor identifier instead was considered and rejected: it
   reports correct aliasing sites as wrong.
2. A computed value (`Math.min(...)`, a ternary, a member expression) is allowed.
   Guessing at arithmetic produces noise rather than signal.
3. Tier detection is **file-scoped**: a file calling both the reasoning-tier function and
   a cheaper-tier one has the cheap tier's cap reported too. The false positive is the
   safe direction, and the fix is to split the file.

## What would disarm this rule

Moving a cap behind an import (blind spot 1), or renaming the tier function without
updating `tierFunction`. A model swap that makes the tier non-reasoning makes the rule
*unnecessary* rather than wrong — retire it deliberately, do not weaken it.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/services/llm/**/*.ts"],
    plugins: { agentic },
    rules: {
      "agentic/quality-model-token-floor": [
        "error",
        { tierFunction: "getQualityModel", floorIdentifier: "TOKEN_FLOOR" },
      ],
    },
  },
];
```
