import type { TSESTree } from "@typescript-eslint/types";
import { type BridgedSourceCode, defineRule } from "../define-rule.js";

interface Options {
  allow?: string[];
}

const FUNCTION_NODES = new Set<string>([
  "FunctionDeclaration",
  "ArrowFunctionExpression",
  "FunctionExpression",
  "ClassDeclaration",
  "ClassExpression",
]);

/** Is this declaration a function/component rather than data or a type? */
function isFunctionLike(node: TSESTree.Node | null | undefined): boolean {
  return node !== null && node !== undefined && FUNCTION_NODES.has(node.type);
}

/**
 * How many functions a LOCAL export list (`export { a, b }`) names.
 * A re-export is handled by the caller — its functions live in another file.
 */
function functionsInExportList(
  node: TSESTree.ExportNamedDeclaration,
  sourceCode: BridgedSourceCode,
): number {
  const scope = sourceCode.getScope(node);
  let found = 0;
  for (const specifier of node.specifiers) {
    if (specifier.exportKind === "type") continue;
    const name = specifier.local.type === "Identifier" ? specifier.local.name : null;
    const binding = name === null ? undefined : scope.set.get(name);
    const definition = binding?.defs[0]?.node as TSESTree.Node | undefined;
    if (isFunctionLike(definition)) {
      found += 1;
    } else if (definition?.type === "VariableDeclarator" && isFunctionLike(definition.init)) {
      found += 1;
    }
  }
  return found;
}

export default defineRule<Options, "tooMany">({
  meta: {
    type: "problem",
    docs: {
      description: "Enforce one exported function per file.",
      // WHY: a convention — one exported function per file, with the filename
      // matching it (kebab-case: `list-jobs.ts` -> `listJobs`). Colocating
      // several exported functions makes the filename stop predicting the export
      // and hides where a symbol lives.
      //
      // THE PREDICATE IS "EXPORTED FUNCTIONS", AND THAT CHOICE IS LOAD-BEARING.
      // This rule replaced a bespoke script that counted "any top-level function
      // or class definition, exported OR PRIVATE" — strictly stricter than the
      // convention it claimed to enforce. Every file with one export plus private
      // helpers had to buy an allowlist entry despite fully satisfying the rule,
      // and that mismatch was the entire reason the allowlist had grown to 240
      // entries. Correcting the predicate dropped 213 of them — they had never
      // been violations — and simultaneously surfaced 3 REAL violations the
      // script was blind to, each a file exporting two functions where one is a
      // type-annotated arrow const (`export const isIgnored: (…) => boolean =`),
      // a shape its regex did not count.
      //
      // Counting ALL exports (not just functions) was measured and rejected: it
      // flags pure data modules, which the convention never meant to forbid.
      //
      // POLARITY: data consts, types and interfaces are NOT functions and do not
      // count. Private helpers may co-locate freely — that is the whole point.
      // The `allow` option is for files that genuinely export more than one
      // function and have a stated reason.
      //
      // KNOWN BLIND SPOTS:
      //  1. `export const x = cond ? fnA : fnB` exports a function this cannot
      //     see statically — the initialiser is a conditional, not a function
      //     node.
      //  2. A RE-export (`export { a } from "./x"`) is not counted — the function
      //     lives in another file — so a barrel is never a violation. A LOCAL
      //     export list (`export { a, b }`) IS counted, by resolving each
      //     specifier to its binding. Conflating those two shapes is an easy
      //     mistake: it silently lets local lists through.
      //  3. Scope is controlled entirely by the config block's files/ignores.
      //     Framework directories that REQUIRE a default export per file (e.g. a
      //     file-based router) belong in `ignores`, not here.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/one-export-per-file.md",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooMany:
        "{{count}} exported functions in one file — the convention asks for one, " +
        "with the filename matching it. Private helpers may co-locate freely; " +
        "split the extra exported functions into their own files.",
    },
  },

  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(/\\/g, "/");
    const allow = context.options[0]?.allow ?? [];
    if (allow.some((suffix) => filename.endsWith(suffix))) return {};

    let count = 0;

    return {
      ExportNamedDeclaration(node) {
        // A RE-export (`export { a } from "./x"`) names no local binding — the
        // function lives in another file, so it is not a definition here.
        if (node.source) return;

        // A LOCAL export list (`export { a, b }`) is different, and conflating
        // the two was a real coverage hole: the replaced script counted the
        // underlying `function` lines regardless of export syntax. Resolve each
        // specifier to its binding and count the ones that are functions.
        if (!node.declaration) {
          count += functionsInExportList(node, context.sourceCode);
          return;
        }
        const declaration = node.declaration;
        if (declaration.type === "VariableDeclaration") {
          count += declaration.declarations.filter((d) => isFunctionLike(d.init)).length;
          return;
        }
        if (isFunctionLike(declaration)) count += 1;
      },

      ExportDefaultDeclaration(node) {
        if (isFunctionLike(node.declaration)) count += 1;
      },

      "Program:exit"(node) {
        if (count > 1) {
          context.report({ node, messageId: "tooMany", data: { count: String(count) } });
        }
      },
    };
  },
});
