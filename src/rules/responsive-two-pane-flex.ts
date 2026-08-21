import type { TSESTree } from "@typescript-eslint/types";
import { defineRule } from "../define-rule.js";

import {
  flexFactorOfJsxAttribute,
  flexFactorOfProperty,
  isBreakpointGuarded,
  rootTagName,
} from "../breakpoint-guard.js";

const UNCONDITIONAL_FLEX = 1;

// Components whose `flex={1}` is required by the sticky-footer scroll chain, not
// a pane. Tamagui's ScrollView computes `flex: 1 0 auto` otherwise and goes dead
// to scroll, so these must stay exempt.
const EXEMPT_TAGS = new Set(["ScrollView", "SafeAreaView", "KeyboardAvoidingView"]);

const ADVICE =
  "Move the flex behind the breakpoint: `minWidth={0} $gtMd={CONTENT_PANE_GTMD}` " +
  "with `const CONTENT_PANE_GTMD = { flex: 1 };`. On mobile the basis then falls " +
  "back to `auto` and the parent's `alignItems: stretch` keeps full width.";

/** The base component of a `styled(Base, {...})` call, or null. */
function styledBaseName(objectExpression: TSESTree.Node): string | null {
  const call = objectExpression.parent;
  if (call?.type !== "CallExpression") return null;
  if (call.callee.type !== "Identifier" || call.callee.name !== "styled") return null;
  if (call.arguments[1] !== objectExpression) return null;
  const base = call.arguments[0];
  return base?.type === "Identifier" ? base.name : null;
}

export default defineRule<never, "collapsingFlex">({
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban an unconditional flex: 1 in a screen that lays out a responsive two-pane column.",
      // WHY: a container that is a COLUMN on mobile and only becomes a ROW at a
      // breakpoint (`flexDirection="column"` + `$gtMd={{ flexDirection: "row" }}`)
      // has an indefinite height on mobile. Tamagui compiles `flex: 1` to
      // `flex: 1 1 0px`, and react-native-web resolves that absolute flex-basis to
      // a COMPUTED HEIGHT OF 0 there — so the content pane collapses, its children
      // overflow, and everything after it in the scroll column slides up.
      //
      // Worth knowing: a plain browser does NOT reproduce this. Browsers resolve a
      // 0px basis against content in an indefinite column; react-native-web
      // collapses it. A CSS replica will tell you the code is fine.
      //
      // SIGNAL-GATED, and the gate is the point: without the `$gt*` row-switch
      // precondition this would ban `flex={1}` outright, one of the most common
      // correct RN idioms. File-scoped detection is PINNED — deliberately not
      // "improved" with module resolution. Relaxing a guard's polarity to chase
      // elegance is how it stops catching what it was built for.
      //
      // POLARITY: bias toward false positives. A false positive costs one
      // deliberate look; a false negative costs another shipped regression.
      //
      // KNOWN BLIND SPOTS:
      //  1. Detection is FILE-scoped: a file must itself contain both the column
      //     container and the `$gt*` row switch. If those separate — a shared
      //     `TwoPaneLayout` primitive owning the container while a consumer passes
      //     the pane — NEITHER file matches both signals and this goes blind.
      //     That is not hypothetical; it is why the sibling rule
      //     `workspace-chrome-flex` exists. Revisit BOTH rules in any change that
      //     extracts a layout container.
      //  2. Only numeric literals are matched; `flex: someVar` is not seen.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/responsive-two-pane-flex.md",
    },
    schema: [],
    messages: {
      collapsingFlex:
        "{{form}} inside a responsive two-pane screen. On the mobile column this " +
        "compiles to flex-basis:0px and react-native-web computes a HEIGHT OF 0, " +
        "collapsing the pane so its content overflows onto the footer. " +
        ADVICE,
    },
  },

  create(context) {
    // File-scoped signals, resolved at Program:exit — a per-node rule cannot
    // know whether the row switch appears later in the file.
    let hasColumnContainer = false;
    let hasBreakpointProp = false;
    let hasRowDirection = false;
    const candidates: Array<{ node: TSESTree.Node; form: string }> = [];

    return {
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : null;
        if (
          name === "flexDirection" &&
          node.value?.type === "Literal" &&
          node.value.value === "column"
        ) {
          hasColumnContainer = true;
        }
        if (typeof name === "string" && /^\$gt(?:Sm|Md|Lg)$/.test(name)) {
          hasBreakpointProp = true;
        }

        if (flexFactorOfJsxAttribute(node) !== UNCONDITIONAL_FLEX) return;
        if (isBreakpointGuarded(node)) return;
        const tag = node.parent.type === "JSXOpeningElement" ? rootTagName(node.parent.name) : null;
        if (tag && EXEMPT_TAGS.has(tag)) return;
        candidates.push({ node, form: `<${tag ?? "?"} flex={1}>` });
      },

      Property(node) {
        const key = node.key.type === "Identifier" ? node.key.name : null;
        if (key === "flexDirection" && node.value.type === "Literal" && node.value.value === "row") {
          hasRowDirection = true;
        }
        if (key && /^\$gt(?:Sm|Md|Lg)$/.test(key)) hasBreakpointProp = true;

        if (flexFactorOfProperty(node) !== UNCONDITIONAL_FLEX) return;
        if (isBreakpointGuarded(node)) return;
        const objectExpression = node.parent;
        const base = styledBaseName(objectExpression);
        if (base === null || EXEMPT_TAGS.has(base)) return;
        candidates.push({ node, form: `styled(${base}, { flex: 1 })` });
      },

      "Program:exit"() {
        if (!hasColumnContainer || !hasBreakpointProp || !hasRowDirection) return;
        for (const { node, form } of candidates) {
          context.report({ node, messageId: "collapsingFlex", data: { form } });
        }
      },
    };
  },
});
