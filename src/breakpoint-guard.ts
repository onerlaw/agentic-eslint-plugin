import type { TSESTree } from "@typescript-eslint/types";

// Shared by the two flex rules. A `flex` behind a `$gt*` breakpoint is the
// CORRECT guarded form — the whole point of both guards is that an
// UNCONDITIONAL flex basis collapses on the mobile column — so both rules must
// forgive it, and they must forgive it the same way.

const BREAKPOINT_KEY = /^\$gt(?:Sm|Md|Lg)$/;
const BREAKPOINT_CONST = /_GTMD$/;

function keyName(property: TSESTree.Property): string | null {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
}

/**
 * True when `node` sits inside a `$gt*` breakpoint scope, in any of the three
 * spellings this codebase uses:
 *   1. an object property   — `{ $gtMd: { flex: 1 } }`
 *   2. a JSX attribute      — `<View $gtMd={{ flex: 1 }} />`
 *   3. a named const        — `const CONTENT_PANE_GTMD = { flex: 1 }`
 *
 * Spelling 3 is why the `*_GTMD` SUFFIX is load-bearing rather than cosmetic:
 * it is the cheapest way to recognise a breakpoint-scoped object that has been
 * lifted out of its JSX. The replaced script said so in as many words —
 * stripping those consts is "what lets the rule stay this blunt".
 */
export function isBreakpointGuarded(node: TSESTree.Node): boolean {
  for (
    let current: TSESTree.Node | undefined = node;
    current;
    current = current.parent
  ) {
    if (current.type === "Property") {
      const name = keyName(current);
      if (name !== null && BREAKPOINT_KEY.test(name)) return true;
    }
    if (
      current.type === "JSXAttribute" &&
      current.name.type === "JSXIdentifier" &&
      BREAKPOINT_KEY.test(current.name.name)
    ) {
      return true;
    }
    if (current.type === "VariableDeclarator" && current.id.type === "Identifier") {
      if (BREAKPOINT_CONST.test(current.id.name)) return true;
    }
  }
  return false;
}

/** The `flex` numeric value of a `flex: N` property, or null. */
export function flexFactorOfProperty(property: TSESTree.Node): number | null {
  if (property.type !== "Property" || keyName(property) !== "flex") return null;
  const { value } = property;
  return value.type === "Literal" && typeof value.value === "number" ? value.value : null;
}

/** The `flex` numeric value of a `flex={N}` JSX attribute, or null. */
export function flexFactorOfJsxAttribute(attribute: TSESTree.Node): number | null {
  if (attribute.type !== "JSXAttribute") return null;
  if (attribute.name.type !== "JSXIdentifier" || attribute.name.name !== "flex") return null;
  const value = attribute.value;
  if (value?.type !== "JSXExpressionContainer") return null;
  const expression = value.expression;
  return expression.type === "Literal" && typeof expression.value === "number"
    ? expression.value
    : null;
}

/**
 * The root identifier a JSX tag resolves through: `View` -> View, `RN.View` -> RN.
 * Shared because two rules key on the tag's BINDING, and a fix to how a wrapper
 * spelling resolves must land in both or they diverge silently.
 */
export function rootTagName(
  nameNode: TSESTree.JSXTagNameExpression,
): string | null {
  let current: TSESTree.JSXTagNameExpression = nameNode;
  while (current.type === "JSXMemberExpression") current = current.object;
  return current.type === "JSXIdentifier" ? current.name : null;
}
