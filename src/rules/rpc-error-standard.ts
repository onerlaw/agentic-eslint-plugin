import type { TSESTree } from "@typescript-eslint/types";
import { defineRule } from "../define-rule.js";

interface Options {
  errorModule: string;
  package?: string;
  bannedSpecifiers?: string[];
  sentinels?: string[];
  consentHelper?: string;
  extraExemptPathSegments?: string[];
}

const DEFAULT_CONNECT_PACKAGE = "@connectrpc/connect";
const DEFAULT_BANNED_SPECIFIERS = ["Code", "ConnectError"];

/**
 * The standard's own home is exempt — it is the one place allowed to
 * instanceof/code-check — as are test files, which construct wire errors to
 * exercise hooks.
 *
 * NOTE the test exemption here is the single `.test.` form, NOT the three-form
 * exemption `workspace-runtime-imports` uses. That is not an oversight: the two
 * guards genuinely cover different trees, and collapsing them into one shared
 * helper would silently change what each exempts.
 */
function isExempt(filePath: string, segments: readonly string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (/\.test\.[jt]sx?$/.test(normalized)) return true;
  return segments.some((segment) => normalized.includes(segment));
}

export default defineRule<Options, "bannedImport" | "namespaceImport" | "consentHelper" | "sentinel">({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce the one frontend RPC error-handling standard: feature code never hand-classifies RPC failures.",
      // WHY: every RPC/network failure should route through ONE error module.
      // Left alone, per-feature classification breeds divergent catch blocks —
      // dozens of them, each deciding for itself what a given status code means,
      // drifting apart as they are copied. Unifying that is cheap once; keeping
      // it unified is what this guard is for.
      //
      // FOUR predicates, deliberately in ONE rule — they enforce one standard and
      // share one file-scope decision:
      //   1. value imports of the banned classification symbols, from ANY path;
      //   2. a namespace import of the RPC client package;
      //   3. an import of the configured consent-helper name from outside the
      //      error module;
      //   4. a raw configured sentinel string literal.
      //
      // Predicates 3 and 4 are DARK BY DEFAULT — `consentHelper` unset and
      // `sentinels: []` — because they encode project-specific literals with no
      // generic analogue. Predicates 1 and 2 carry sensible defaults and are
      // always live. Do not read an unconfigured predicate as a passing one.
      //
      // PREDICATE 1 MATCHES BY NAME, FROM ANY SPECIFIER — not by module path, and
      // that is the whole reason this cannot be stock config. A re-export barrel
      // hides path-keyed matches completely: point a path-keyed check
      // (`no-restricted-imports`) at the client package and every violation that
      // reaches it through a local barrel disappears from the report while
      // looking clean.
      //
      // POLARITY: default-deny by name. `import type` / inline `type` specifiers
      // stay legal — a type-only reference cannot hand-classify anything at
      // runtime.
      //
      // THE EXEMPTION IS A CORRECTNESS CARVE-OUT, NOT A TUNING KNOB. `errorModule`
      // is required precisely because the module implementing the standard must be
      // allowed to touch the APIs the rule bans everywhere else. Default it empty
      // and the rule reports the very code that discharges it.
      //
      // KNOWN BLIND SPOTS:
      //  1. A renamed re-export (`export { Code as Foo }` elsewhere, then
      //     importing `Foo`) defeats name matching. Accepted residual.
      //  2. A dynamic `import()` or a computed member access is not seen.
      //  3. The sentinel predicate compares AST literal values, so a concatenated
      //     or templated construction of the same string is invisible — and,
      //     deliberately, so is the sentinel inside a COMMENT. A comment naming
      //     the sentinel is documentation, not a hand-classification; a raw text
      //     scan flags it and that is noise.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/rpc-error-standard.md",
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
            errorModule: { type: "string", minLength: 1 },
            package: { type: "string", minLength: 1 },
            bannedSpecifiers: { type: "array", items: { type: "string", minLength: 1 } },
            sentinels: { type: "array", items: { type: "string", minLength: 1 } },
            consentHelper: { type: "string", minLength: 1 },
            extraExemptPathSegments: { type: "array", items: { type: "string", minLength: 1 } },
          },
          required: ["errorModule"],
          additionalProperties: false,
        },
      ],
    },
    messages: {
      bannedImport: 'value import of {{name}} from "{{source}}" — {{advice}}',
      namespaceImport: "namespace import of {{package}} — {{advice}}",
      consentHelper: '{{name}} import from "{{source}}" — {{advice}}',
      sentinel: 'raw "{{sentinel}}" sentinel literal — {{advice}}',
    },
  },

  create(context) {
    const options = context.options[0];
    // The schema is a FULL array schema with `minItems: 1`, so ESLint rejects the
    // config before `create` ever runs — see tests/required-options.test.ts. This
    // guard is unreachable; it exists only so the required fields above can be
    // typed as required rather than smuggled in as optional.
    if (!options) return {};
    const { errorModule, consentHelper } = options;
    const connectPackage = options.package ?? DEFAULT_CONNECT_PACKAGE;
    const banned = new Set(options.bannedSpecifiers ?? DEFAULT_BANNED_SPECIFIERS);
    const sentinels = new Set(options.sentinels ?? []);
    const advice = `route through ${errorModule} instead`;

    // The standard's own module must be able to touch what the rule bans
    // everywhere else — otherwise the rule reports the very code that
    // discharges it. This is a correctness carve-out, not bias tuning, which
    // is why `errorModule` is required rather than defaulted empty.
    const exemptSegments = [errorModule, ...(options.extraExemptPathSegments ?? [])];

    const filename = context.filename ?? context.getFilename();
    if (isExempt(filename, exemptSegments)) return {};

    /** Predicate 2: a namespace import of the connect package. */
    function checkNamespace(specifier: TSESTree.Node, source: string): void {
      if (source !== connectPackage) return;
      context.report({
        node: specifier,
        messageId: "namespaceImport",
        data: { package: connectPackage, advice },
      });
    }

    /** Predicates 1 and 3: banned value names, from ANY module path. */
    function checkNamed(specifier: TSESTree.ImportSpecifier, source: string): void {
      // Inline `import { type Code }` binds no value.
      if (specifier.importKind === "type") return;
      const name = specifier.imported.type === "Identifier" ? specifier.imported.name : "";
      if (banned.has(name)) {
        context.report({
          node: specifier,
          messageId: "bannedImport",
          data: { name, source, advice },
        });
      }
      if (consentHelper !== undefined && name === consentHelper) {
        context.report({
          node: specifier,
          messageId: "consentHelper",
          data: { name, source, advice },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        // A whole-statement type import binds no value.
        if (node.importKind === "type") return;
        const source = node.source.value;

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") checkNamespace(specifier, source);
          if (specifier.type === "ImportSpecifier") checkNamed(specifier, source);
        }
      },

      Literal(node) {
        if (typeof node.value === "string" && sentinels.has(node.value)) {
          context.report({ node, messageId: "sentinel", data: { sentinel: node.value, advice } });
        }
      },

      TemplateElement(node) {
        const cooked = node.value?.cooked;
        if (typeof cooked === "string" && sentinels.has(cooked)) {
          context.report({ node, messageId: "sentinel", data: { sentinel: cooked, advice } });
        }
      },
    };
  },
});
