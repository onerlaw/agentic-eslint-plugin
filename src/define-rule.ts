import type { Rule, Scope, SourceCode } from "eslint";
import type { TSESTree } from "@typescript-eslint/types";

// The TSESTree import is TYPE-ONLY and therefore erased at build, which is what
// lets @typescript-eslint/types stay a devDependency while the published package
// keeps ZERO runtime dependencies. It is imported at all because ESLint's own
// bundled types are vanilla ESTree: they carry no JSX variants, so a
// `JSXAttribute(node)` handler typed against them silently degrades to `any`
// (TS7006) — no safety at all on the four most AST-sensitive files here.

type NodeByType<K extends TSESTree.Node["type"]> = Extract<TSESTree.Node, { type: K }>;

/**
 * Every node type gets a typed handler AND a typed `:exit` counterpart.
 *
 * The `:exit` half is generated across the whole union rather than special-casing
 * `Program:exit` (the only one used today). Special-casing would type-check the
 * current rules by coincidence and drop the next `"VariableDeclaration:exit"`
 * back to implicit `any` — the exact failure this file exists to prevent.
 */
/**
 * ESLint's own API types are estree-based while TSESTree is a superset, so the
 * two disagree at every API boundary. Bridging it HERE, once, is why no rule
 * body needs a cast — the alternative was the same cast repeated in every rule
 * that touches scope or comments.
 */
export type BridgedSourceCode = Omit<
  SourceCode,
  "getScope" | "getAllComments" | "getText"
> & {
  getScope(node: TSESTree.Node): Scope.Scope;
  getAllComments(): TSESTree.Comment[];
  getText(node?: TSESTree.Node, before?: number, after?: number): string;
};

export type Visitor = {
  [K in TSESTree.Node["type"]]?: (node: NodeByType<K>) => void;
} & {
  [K in TSESTree.Node["type"] as `${K}:exit`]?: (node: NodeByType<K>) => void;
};

/**
 * A zero-dependency stand-in for `ESLintUtils.RuleCreator`.
 *
 * Returns ESLint's own `Rule.RuleModule`, so nothing from this file reaches the
 * emitted `dist/*.d.ts` — consumers need no dependency beyond the `eslint` peer
 * they already have.
 *
 * THERE IS DELIBERATELY NO `defaultOptions`. The four rules with required options
 * use a full array schema with `minItems: 1` precisely so that enabling them
 * unconfigured is a config ERROR rather than a silent no-op, and a TS-level
 * default is exactly the quiet fallback that convention exists to prevent.
 * Options here are typed, never defaulted.
 *
 * WHAT IT CHECKS: option field access (TS2551 on a typo), `report()` message ids
 * against the union (TS2322), visitor keys against real node types, and node
 * property access including JSX (TS2339).
 * WHAT IT DOES NOT CHECK: an extra, unused key in `messages` is accepted. A
 * message nobody reports is harmless, and catching it is not worth a stricter
 * signature.
 *
 * The single `as unknown as` below is the one unchecked seam in the facade —
 * bridging this authoring type to ESLint's looser runtime type. It is contained
 * to this line on purpose.
 */
export function defineRule<TOptions, TMessageIds extends string>(rule: {
  meta: Rule.RuleMetaData & { messages: Record<TMessageIds, string> };
  create(
    context: Omit<Rule.RuleContext, "options" | "report" | "sourceCode"> & {
      options: readonly TOptions[];
      // ESLint's own API types are estree-based while TSESTree is a superset, so
      // the two disagree at every API boundary. Bridging it HERE, once, is why no
      // rule body needs a cast — the alternative was the same cast repeated in
      // every rule that touches scope or comments.
      sourceCode: BridgedSourceCode;
      report(descriptor: {
        // `Comment` is included because `no-biome-ignore` reports on comments,
        // which ESLint accepts (they carry `loc`/`range`) even though its own
        // ReportDescriptor names only Node.
        node: TSESTree.Node | TSESTree.Comment;
        messageId: TMessageIds;
        data?: Record<string, string>;
      }): void;
    },
  ): Visitor;
}): Rule.RuleModule {
  const { meta, create } = rule;
  return { meta, create: create as unknown as Rule.RuleModule["create"] };
}
