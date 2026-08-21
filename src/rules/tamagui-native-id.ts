import type { TSESTree } from "@typescript-eslint/types";
import { rootTagName } from "../breakpoint-guard.js";
import { defineRule } from "../define-rule.js";

interface Options {
  forwarders?: Record<string, string[]>;
}

const REACT_NATIVE = "react-native";
const BANNED_PROP = "nativeID";

/**
 * Build the forwarder map from the `forwarders` option: module specifier -> the
 * exact export names known to forward props to a genuine react-native
 * component, so `nativeID` still reaches the DOM through them.
 *
 * Keyed by NAME, not just specifier — that is deliberate. A second export added
 * to one of those modules would otherwise silently inherit the exemption
 * without forwarding anything.
 */
function forwarderMap(forwarders: Record<string, string[]>): Map<string, Set<string>> {
  return new Map(
    Object.entries(forwarders).map(([source, names]) => [source, new Set(names)] as const),
  );
}

const ADVICE =
  "Use the `id` prop instead — it reaches the DOM on web, and Tamagui maps it back " +
  "to nativeID on native. If the element must be a react-native component for " +
  'another reason (a third-party mount point), import it from "react-native" ' +
  "directly.";

/**
 * Does this specifier bind a name to a genuine react-native component?
 * A default or namespace import can only be RN-backed via react-native itself —
 * the forwarder modules are named-export only. A type-only specifier binds no
 * value at all.
 */
function bindsReactNative(
  specifier: TSESTree.ImportClause,
  isReactNative: boolean,
  forwarded: Set<string> | undefined,
): boolean {
  if (
    specifier.type === "ImportDefaultSpecifier" ||
    specifier.type === "ImportNamespaceSpecifier"
  ) {
    return isReactNative;
  }
  if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") return false;
  // `imported` is Identifier | StringLiteral; only the Identifier form can name
  // a forwarded export, which is what the original `?.name` access meant.
  const importedName = specifier.imported.type === "Identifier" ? specifier.imported.name : null;
  return isReactNative || (importedName !== null && Boolean(forwarded?.has(importedName)));
}

export default defineRule<Options, "droppedNativeId">({
  meta: {
    type: "problem",
    docs: {
      description: 'Ban `nativeID` on any component not imported directly from "react-native".',
      // WHY: `nativeID` becomes a DOM `id` on web ONLY for react-native
      // components — react-native-web's `createDOMProps` does
      // `domProps.id = id ?? nativeID`. A Tamagui component (or a `styled()`
      // wrapper of one) DROPS it: no `id` attribute is rendered, and React logs
      // an unrecognized-prop error. Anything that then looks the element up —
      // getElementById, scrollIntoView, a CSS attribute selector, a third-party
      // mount point — silently finds nothing.
      //
      // This is a react-native-web constraint, not a Tamagui one; only the
      // suggested remedy ("use `id`") is Tamagui-flavoured. The rule needs no
      // Tamagui-specific machinery and shares nothing with this package's
      // breakpoint rules beyond a generic JSX tag-name resolver.
      //
      // POLARITY: default-deny, and PINNED. A tag is presumed NOT react-native
      // unless it is imported from "react-native" directly or via a configured
      // `forwarders` entry. Resolving the module graph to spare locally-defined
      // `styled()` wrappers was considered and rejected — it would trade a loud,
      // cheap false positive for a silent, expensive false negative, and the
      // failure this catches is invisible at runtime until something tries to
      // find the element.
      //
      // KNOWN BLIND SPOTS:
      //  1. A component re-exported through a barrel is not resolved and will be
      //     flagged. Add it to `forwarders` if it genuinely forwards.
      //  2. A tag whose root cannot be resolved statically (a computed member
      //     expression) is reported rather than skipped — again the safe side.
      //  3. `forwarders` is keyed by module specifier as WRITTEN, so the same
      //     module reached by two different specifiers needs both entries.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/tamagui-native-id.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          forwarders: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string", minLength: 1 } },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      droppedNativeId:
        "<{{tag}} " +
        BANNED_PROP +
        '=...> — {{tag}} is not imported from "react-native", so on web this ' +
        "renders NO DOM id and every getElementById/scrollIntoView/CSS lookup for " +
        "it fails silently. " +
        ADVICE,
    },
  },

  create(context) {
    const forwarders = forwarderMap(context.options[0]?.forwarders ?? {});

    /** Local names bound to a genuine react-native component. */
    const reactNativeBindings = new Set<string>();
    const candidates: Array<{
      node: TSESTree.JSXAttribute;
      tag: string | null;
      text: string;
    }> = [];

    return {
      ImportDeclaration(node) {
        // A type-only import binds no value, so it can never be a JSX tag.
        if (node.importKind === "type") return;

        const source = node.source.value;
        const isReactNative = source === REACT_NATIVE;
        const forwarded = forwarders.get(source);
        if (!isReactNative && !forwarded) return;

        for (const specifier of node.specifiers) {
          if (bindsReactNative(specifier, isReactNative, forwarded)) {
            reactNativeBindings.add(specifier.local.name);
          }
        }
      },

      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== BANNED_PROP) return;
        if (node.parent.type !== "JSXOpeningElement") return;
        const nameNode = node.parent.name;
        const tag = rootTagName(nameNode);
        const text = context.sourceCode.getText(nameNode);
        candidates.push({ node, tag, text });
      },

      "Program:exit"() {
        for (const { node, tag, text } of candidates) {
          if (tag && reactNativeBindings.has(tag)) continue;
          context.report({
            node,
            messageId: "droppedNativeId",
            data: { tag: text || tag || "?" },
          });
        }
      },
    };
  },
});
