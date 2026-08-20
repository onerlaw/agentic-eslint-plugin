# `tamagui-native-id`

Ban `nativeID` on any component not imported directly from `react-native`.

> **Requires react-native-web.** The suggested remedy assumes Tamagui.

## Why

`nativeID` becomes a DOM `id` on web **only** for react-native components —
react-native-web's `createDOMProps` does `domProps.id = id ?? nativeID`. A Tamagui
component, or a `styled()` wrapper of one, drops it: no `id` attribute is rendered, and
React logs an unrecognized-prop error.

Anything that then looks the element up — `getElementById`, `scrollIntoView`, a CSS
attribute selector, a third-party mount point — silently finds nothing. The failure is
invisible at runtime until something tries to find the element, which is typically a
third-party widget that then has nowhere to mount.

This is a **react-native-web** constraint, not a Tamagui one. Only the suggested remedy
("use `id`; Tamagui maps it back to `nativeID` on native") is Tamagui-flavoured. The rule
shares nothing with this package's breakpoint rules beyond a generic JSX tag-name resolver.

## What it catches

```tsx
// ✗ Tamagui component drops it — no DOM id on web
<YStack nativeID="captcha-mount" />

// ✗ a styled() wrapper is not react-native either
<Card nativeID="anchor" />

// ✓ imported directly from react-native
import { View } from "react-native";
<View nativeID="captcha-mount" />

// ✓ the portable prop
<YStack id="captcha-mount" />
```

## Options

| Option | Type | Required | Meaning |
|---|---|---|---|
| `forwarders` | `Record<string, string[]>` | no (`{}`) | Module specifier → the exact export names known to forward props onto a genuine react-native component. |

Keyed by **name**, not just specifier, and that is deliberate: a second export added to
one of those modules would otherwise silently inherit the exemption without forwarding
anything.

```js
{ forwarders: { "@/components/ui/text-input": ["TextInput"], "./text-input": ["TextInput"] } }
```

## Polarity — default-deny, and pinned

A tag is presumed **not** react-native unless imported from `react-native` directly or
via a configured `forwarders` entry.

Resolving the module graph to spare locally-defined `styled()` wrappers was considered
and **rejected**. It would trade a loud, cheap false positive for a silent, expensive
false negative. Do not "improve" this — relaxing a guard's polarity to chase elegance is
how it stops catching what it was built for.

## Known blind spots

1. A component re-exported through a barrel is not resolved and will be flagged. Add it
   to `forwarders` if it genuinely forwards.
2. A tag whose root cannot be resolved statically (a computed member expression) is
   reported rather than skipped — again the safe side.
3. `forwarders` is keyed by module specifier **as written**, so the same module reached by
   two different specifiers needs both entries.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.tsx"],
    plugins: { agentic },
    rules: {
      "agentic/tamagui-native-id": [
        "error",
        { forwarders: { "@/components/ui/text-input": ["TextInput"] } },
      ],
    },
  },
];
```
