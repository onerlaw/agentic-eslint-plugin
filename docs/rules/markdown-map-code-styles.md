# `markdown-map-code-styles`

Require every markdown style map to build its code rules from the shared builder.

> **Requires options.** See [Options](#options).

## Why

`react-native-markdown-display` merges a consumer's style map with its own defaults
**per property**, so every default the consumer does not explicitly displace survives.
Two shapes of that bite, and neither is visible to a type-checker or a formatter — both
are perfectly valid objects:

1. Writing `paddingHorizontal` inherits `padding: 10` beside it, which draws an
   inline-code chip taller than its line and overlaps the line above.
2. Writing no code rules at all inherits the library's entire unthemed grey box, which on
   a dark page is a bright rectangle.

## Why a guard rather than a review note

The second shape is invisible until content happens to contain a code span, so a surface
carrying it can sit broken indefinitely with nobody reporting it. A defect nobody reports
is exactly the kind that needs mechanizing.

The usual alternative — a hand-enumerated test per known map — pins the maps that exist
today and is silent about the next one. An enumeration written from memory is a guard
that decays.

## The predicate, and why it is this one

A markdown style map has no naming convention to key on; spellings vary per file. What
such a file *cannot* omit is the import of the shared font-style constant, because
without it the library renders the whole document in the OS system font. **Keying a guard
on the thing the file cannot leave out** is what makes it hard to evade by accident.

## What it catches

```ts
// ✗ imports the marker, never calls the builder
import { FONT_STYLES } from "@/lib/markdown-font-styles";
export function buildLegalStyles(theme) {
  return { ...FONT_STYLES, body: { fontSize: 16 } };
}

// ✓
import { FONT_STYLES } from "@/lib/markdown-font-styles";
import { buildCodeStyles } from "@/lib/markdown-code-styles";
export function buildLegalStyles(theme) {
  return { ...FONT_STYLES, ...buildCodeStyles(theme) };
}
```

## Options

| Option | Type | Required | Meaning |
|---|---|---|---|
| `markerImport` | `string` | **yes** | Imported name whose presence marks the file as a markdown style map. |
| `builder` | `string` | **yes** | Imported name the file must also use. |

Both are matched on the **imported** name, so an aliased local binding still resolves.

## Polarity

Default-deny for any file importing `markerImport`. A file importing it for some
unrelated reason would be a false positive — treat that as a signal the constant is doing
two jobs.

## Known blind spots

1. Import-level detection only. A file that imports the builder but never calls it, or
   calls it and discards the result, passes.
2. A re-export barrel that renames the constant defeats it.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { agentic },
    rules: {
      "agentic/markdown-map-code-styles": [
        "error",
        { markerImport: "FONT_STYLES", builder: "buildCodeStyles" },
      ],
    },
  },
];
```
