# `workspace-chrome-flex`

Ban any unguarded flex grow factor in a shared two-pane layout's chrome.

> **Requires Tamagui** (recognises `$gtSm`/`$gtMd`/`$gtLg` and `*_GTMD` constants).

## Why

Glob this at the folder holding a two-pane layout's **shared** style constants and leaf
components — the pane-fill and ratio objects that get spread straight onto both screens'
panes. An unguarded `flex` written there reaches the collapsing mobile column exactly as
if it had been written in the screen file. On a mobile column a flex factor compiles to
`flex-basis: 0px` and react-native-web computes a **height of 0**.

## Why it is blunter than its sibling

[`responsive-two-pane-flex`](./responsive-two-pane-flex.md) requires a column/row signal
in the same file. This rule requires none, because **a shared module has no local evidence
of which axis its consumer flows in** — which is exactly the failure that shipped once a
layout container was extracted, moving the code out from under the sibling rule's
file-scoped detection.

That is the general lesson: extracting shared code silently moves a file-scoped guard's
coverage. When you extract, check what stopped being watched.

It also matches **any** grow factor, not just 1 — `flex: N` sets a basis of 0 for every N.

## What it catches

```tsx
// ✗ unguarded in shared chrome
export const PANE_FILL = { flex: 1 };
<View flex={2} />

// ✓ behind a breakpoint
export const PANE_FILL_GTMD = { flex: 1 };
<View $gtMd={{ flex: 1 }} />

// ✓ no basis asserted
<View flexGrow={1} flexShrink={1} />
```

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `allow` | `string[]` | `[]` | Path suffixes exempted from the rule. |

## Polarity

Default-deny inside the globbed folder. The `*_GTMD` naming convention is **load-bearing,
not cosmetic** — it is how a breakpoint-scoped object lifted out of JSX stays
recognisable, and stripping those consts is what lets the rule stay this blunt.

## Known blind spots

1. A computed flex value (`flex: someVar`) is not a numeric literal and is not seen.
2. A flex spread in from another module (`...SHARED`) is not resolved. The folder-wide ban
   compensates: the source object would itself be flagged if it lives in the folder.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/components/workspace/**/*.{ts,tsx}"],
    plugins: { agentic },
    rules: { "agentic/workspace-chrome-flex": "error" },
  },
];
```
