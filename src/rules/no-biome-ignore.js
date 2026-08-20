const BIOME_IGNORE = /biome-ignore/;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ban inline `biome-ignore` suppression comments.",
      // WHY: a suppression comment hides the finding from everyone downstream
      // and carries no obligation to explain itself. The sanctioned escape is a
      // per-file override in `biome.json`, which is reviewable in a diff and
      // forces the exemption to be named — an inline directive is neither.
      //
      // NO STOCK EQUIVALENT EXISTS. `biome-ignore` is a Biome directive; ESLint
      // has no concept of it. (The `@ts-expect-error` analogue is handled by
      // `@typescript-eslint/ban-ts-comment`; this has no such counterpart.)
      //
      // POLARITY: default-deny, no allowlist. There is no legitimate inline use
      // — the override path exists precisely so the exemption lands somewhere a
      // reviewer sees it. Do not add an escape hatch here.
      //
      // KNOWN BLIND SPOTS:
      //  1. Matches the substring `biome-ignore` anywhere in a comment, so prose
      //     ABOUT the directive is flagged too. Accepted: documentation of the
      //     ban belongs in files this rule does not lint.
      //  2. A directive constructed at runtime is not a comment and is invisible.
      //     Meaningless in practice — Biome reads source text.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/no-biome-ignore.md",
    },
    schema: [],
    messages: {
      inlineSuppression:
        "inline `biome-ignore` is banned — fix the underlying issue, or add a " +
        "documented per-file override in biome.json so the exemption is visible " +
        "in review.",
    },
  },

  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (BIOME_IGNORE.test(comment.value)) {
            context.report({ node: comment, messageId: "inlineSuppression" });
          }
        }
      },
    };
  },
};
