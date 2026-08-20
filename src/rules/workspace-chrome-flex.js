import {
  flexFactorOfJsxAttribute,
  flexFactorOfProperty,
  isBreakpointGuarded,
} from "../breakpoint-guard.js";

const ADVICE =
  "A shared workspace module cannot know which axis its consumer flows in, so it " +
  "must not assert a flex basis at all. Use `flexGrow`/`flexShrink` (basis stays " +
  '`auto`) for fill, or `width: "100%"` for a full-width row child.';

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Ban any unguarded flex grow factor in the shared two-pane workspace chrome.",
      // WHY: glob this at the folder holding a two-pane layout's SHARED style
      // constants and leaf components — the pane-fill and ratio objects that get
      // spread straight onto both screens' panes. An unguarded `flex` written
      // there reaches the collapsing mobile column exactly as if it had been
      // written in the screen file. On a mobile COLUMN a flex factor compiles to
      // flex-basis:0px and react-native-web computes a HEIGHT OF 0.
      //
      // This rule is deliberately BLUNTER than its sibling
      // `responsive-two-pane-flex`: no column/row signal is required, because a
      // shared module has no local evidence of which axis its consumer flows in
      // — which is exactly the failure that shipped once a layout container was
      // extracted. It also matches ANY grow factor, not just 1: `flex: N` sets a
      // basis of 0 for every N.
      //
      // POLARITY: default-deny inside this folder. The `*_GTMD` naming
      // convention is LOAD-BEARING, not cosmetic — it is how a breakpoint-scoped
      // object lifted out of JSX stays recognisable, and stripping those consts
      // is what lets the rule stay this blunt.
      //
      // KNOWN BLIND SPOTS:
      //  1. A computed flex value (`flex: someVar`) is not a numeric literal and
      //     is not seen. Unused spelling in this folder today.
      //  2. A flex spread in from another module (`...SHARED`) is not resolved.
      //     The folder-wide ban is what compensates: the source object would
      //     itself be flagged if it lives here.
      // The `allow` option matches by path SUFFIX.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/workspace-chrome-flex.md",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      unguardedFlex:
        "unguarded `flex: {{factor}}` in the shared two-pane workspace chrome. " +
        "On a mobile COLUMN this compiles to flex-basis:0px and react-native-web " +
        "computes a HEIGHT OF 0, collapsing the pane. " +
        ADVICE,
    },
  },

  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/");
    const allow = context.options[0]?.allow ?? [];
    if (allow.some((suffix) => filename.endsWith(suffix))) return {};

    function report(node, factor) {
      context.report({ node, messageId: "unguardedFlex", data: { factor } });
    }

    return {
      Property(node) {
        const factor = flexFactorOfProperty(node);
        if (factor === null || isBreakpointGuarded(node)) return;
        report(node, factor);
      },
      JSXAttribute(node) {
        const factor = flexFactorOfJsxAttribute(node);
        if (factor === null || isBreakpointGuarded(node)) return;
        report(node, factor);
      },
    };
  },
};
