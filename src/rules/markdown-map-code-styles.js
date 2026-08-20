const ADVICE =
  "A markdown style map must take its code rules from {{builder}}(). " +
  "react-native-markdown-display merges a consumer's map with its own defaults PER " +
  "PROPERTY, so a map that writes `paddingHorizontal` inherits `padding: 10` beside " +
  "it, and a map that writes no code rules at all inherits the library's entire " +
  "unthemed grey box. Spread the builder's result and override only what is " +
  "genuinely this surface's own.";

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every markdown style map to build its code rules from the shared builder.",
      // WHY: `react-native-markdown-display` merges a consumer's style map with
      // its own defaults PER PROPERTY, so every default the consumer does not
      // explicitly displace survives. Two shapes of that bite, and neither is
      // visible to a type-checker or a formatter — both are valid objects:
      //   1. writing `paddingHorizontal` inherits `padding: 10` beside it, which
      //      draws an inline-code chip taller than its line and overlaps the line
      //      above;
      //   2. writing no code rules at all inherits the library's entire unthemed
      //      grey box, which on a dark page is a light rectangle.
      //
      // WHY A GUARD RATHER THAN A REVIEW NOTE: the second shape is invisible until
      // content happens to contain a code span, so the surfaces carrying it can sit
      // broken indefinitely without anyone reporting them. A defect nobody reports
      // is exactly the kind that needs mechanizing.
      //
      // WHAT IT REPLACES: typically a hand-enumerated test per known map — which
      // pins the maps that exist today and is silent about the next one. An
      // enumeration written from memory is a guard that decays.
      //
      // THE PREDICATE, AND WHY IT IS THIS ONE: a markdown style map has no naming
      // convention to key on — spellings vary per file. What such a file cannot
      // omit is the import of the shared font-style constant, because without it
      // the library renders the whole document in the OS system font. Keying on
      // the thing the file cannot leave out is what makes the rule hard to evade
      // by accident.
      //
      // POLARITY: default-deny for any file importing `markerImport`. A file that
      // imports it for some unrelated reason would be a false positive; treat that
      // as a signal the constant is doing two jobs.
      //
      // KNOWN BLIND SPOTS:
      //  1. Import-level detection only. A file that imports the builder but never
      //     calls it, or calls it and discards the result, passes.
      //  2. Aliased imports are handled (the check reads the imported name, not
      //     the local binding), but a re-export barrel that renames the constant
      //     defeats it.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/markdown-map-code-styles.md",
    },
    // The schema is a FULL array schema, not the usual array-of-item-schemas.
    // That is deliberate and load-bearing: ESLint validates only the options a
    // config actually PROVIDES, so a `required` inside items[0] never fires
    // when the rule is enabled with no options at all — the single likeliest
    // misconfiguration. `minItems: 1` is what makes omission an error instead
    // of a silent no-op.
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: [
        {
          type: "object",
          properties: {
            markerImport: { type: "string", minLength: 1 },
            builder: { type: "string", minLength: 1 },
          },
          required: ["markerImport", "builder"],
          additionalProperties: false,
        },
      ],
    },
    messages: {
      missingCodeStyles: `This file imports {{markerImport}}, so it builds a markdown style map, but never uses {{builder}}. ${ADVICE}`,
    },
  },

  create(context) {
    const { markerImport, builder } = context.options[0] ?? {};

    /** @type {import("estree").ImportSpecifier | null} */
    let fontStylesImport = null;
    let usesCodeStyles = false;

    return {
      ImportSpecifier(node) {
        // `imported` is the name in the source module, which is what identifies the
        // constant even when the local binding is aliased.
        if (node.imported.type !== "Identifier") return;
        if (node.imported.name === markerImport) fontStylesImport = node;
        if (node.imported.name === builder) usesCodeStyles = true;
      },

      "Program:exit"() {
        if (fontStylesImport === null || usesCodeStyles) return;
        context.report({
          node: fontStylesImport,
          messageId: "missingCodeStyles",
          data: { markerImport, builder },
        });
      },
    };
  },
};
