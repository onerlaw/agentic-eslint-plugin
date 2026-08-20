# `responsive-two-pane-flex`

Ban an unconditional `flex: 1` in a screen that lays out a responsive two-pane column.

> **Requires Tamagui** (recognises `$gtSm`/`$gtMd`/`$gtLg` and `*_GTMD` constants).

## Why

A container that is a **column** on mobile and only becomes a **row** at a breakpoint
(`flexDirection="column"` plus `$gtMd={{ flexDirection: "row" }}`) has an indefinite
height on mobile. Tamagui compiles `flex: 1` to `flex: 1 1 0px`, and react-native-web
resolves that absolute flex-basis to a **computed height of 0** there.

So the content pane collapses, its children overflow, and everything after it in the
scroll column slides up — most visibly, content overlapping the footer.

### A browser will not reproduce this

Browsers resolve a `0px` basis against content in an indefinite column; react-native-web
collapses it. A pure-CSS replica in Chrome will tell you the code is fine. Verify layout
bugs of this shape in a real react-native-web tree, not a replica.

## What it catches

Only in a file that *also* contains a `$gt*` row switch — the gate is the point. Without
that precondition this would ban `flex={1}` outright, one of the most common correct RN
idioms.

```tsx
// ✗ collapses to height 0 on the mobile column
<View flex={1} minWidth={0}>

// ✓ scoped to the row breakpoint
const CONTENT_PANE_GTMD = { flex: 1 };
<View minWidth={0} $gtMd={CONTENT_PANE_GTMD}>
```

On mobile the basis then falls back to `auto`, and the parent's `alignItems: stretch`
keeps full width.

`ScrollView`, `SafeAreaView` and `KeyboardAvoidingView` are exempt: their `flex={1}` is
required by the sticky-footer scroll chain, and Tamagui's ScrollView computes
`flex: 1 0 auto` otherwise and goes dead to scroll.

## Options

None.

## Polarity

Biased toward false positives. A false positive costs one deliberate look; a false
negative costs another shipped regression.

**File-scoped detection is pinned** — deliberately not "improved" with module resolution.

## Known blind spots

1. Detection is **file-scoped**: a file must itself contain both the column container and
   the `$gt*` row switch. If those separate — a shared `TwoPaneLayout` primitive owning
   the container while a consumer passes the pane — neither file matches both signals and
   this goes blind. That is not hypothetical; it is why
   [`workspace-chrome-flex`](./workspace-chrome-flex.md) exists. **Revisit both rules in
   any change that extracts a layout container.**
2. Only numeric literals are matched; `flex: someVar` is not seen.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/screens/**/*.tsx"],
    plugins: { agentic },
    rules: { "agentic/responsive-two-pane-flex": "error" },
  },
];
```
