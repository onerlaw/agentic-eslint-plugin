const DEFAULT_CAP_PROPERTY = "max_tokens";

const ADVICE =
  "A reasoning-tier call site must set {{capProperty}} to {{floorIdentifier}} and " +
  "nothing else. A reasoning model bills its internal thinking against the same " +
  "budget, so a cap sized for output alone is consumed before any output or forced " +
  'tool call emits, and the response returns truncated with finish_reason: "length". ' +
  "Reply length belongs in the prompt, not the cap.";

/** Is this the configured cap key of an object property? */
function isCapProperty(node, capProperty) {
  const key = node.key;
  if (node.computed) return false;
  if (key.type === "Identifier") return key.name === capProperty;
  return key.type === "Literal" && key.value === capProperty;
}

/**
 * Classify a `max_tokens` value against the policy.
 *
 * Resolves exactly ONE level of LOCAL indirection, because that is the shape the
 * shipped bug took: `const ANSWER_MAX_TOKENS = 700` used as the cap.
 * A rule that only banned inline numeric literals would have passed the very file
 * it exists for — repo-wide, `max_tokens: <number>` had zero occurrences.
 *
 * Returns "literal" (inline number), "local-literal" (identifier bound locally to a
 * number), or null (allowed / unresolvable).
 */
function classify(valueNode, localConsts, floorIdentifier) {
  if (valueNode.type === "Literal" && typeof valueNode.value === "number") return "literal";
  if (valueNode.type !== "Identifier") return null;
  if (valueNode.name === floorIdentifier) return null;

  const init = localConsts.get(valueNode.name);
  // Not a local const -> imported, or a parameter. A single-file rule cannot follow
  // an import; see the blind-spot note in meta.docs.
  if (init === undefined) return null;
  if (init.type === "Literal" && typeof init.value === "number") return "local-literal";
  // Bound locally to the floor (or to anything non-numeric) -> allowed.
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban any token cap other than the named floor constant at a reasoning-tier call site.",
      // WHY: a reasoning model counts its internal thinking tokens against the
      // SAME budget as its output. A cap sized for the reply alone is fully
      // consumed before any output or forced tool call emits, and the request
      // returns `finish_reason: "length"` with a truncated body or zero tool
      // calls. The fix is a single named floor constant, high enough to cover
      // thinking, applied at every such call site — reply length is governed by
      // the prompt, not by the cap. A cap is not a spend limit.
      //
      // WHY MECHANIZE IT: nothing else can see it. `tsc` sees a valid number,
      // a formatter sees a valid property, and no unit test observes a live
      // `finish_reason`. The failure surfaces only in production logs, after a
      // user hits it — and it recurs, because each occurrence gets fixed at its
      // own call site and none of those fixes can see the next one coming.
      //
      // POLARITY — errs toward FALSE POSITIVES on locally-declared caps. Any
      // local const bound to a number and used as the cap in a tier file is
      // reported, even if the author believed the number was safe. That is
      // deliberate: "this one is small enough" is precisely the reasoning that
      // ships the bug.
      //
      // ONE LEVEL OF LOCAL INDIRECTION IS RESOLVED, and that matters more than it
      // looks: the shape this actually takes in the wild is a named local const
      // (`const ANSWER_MAX_TOKENS = 700`) used as the cap, not an inline number.
      // A rule banning only inline numeric literals would pass the very files it
      // exists for.
      //
      // KNOWN BLIND SPOTS:
      //  1. An identifier IMPORTED from another module is allowed — a single-file
      //     rule cannot resolve the binding. An alias bound to a literal in
      //     another file therefore passes. Requiring the bare floor identifier
      //     instead was considered and rejected: it reports correct aliasing
      //     sites as wrong.
      //  2. A computed value (`Math.min(...)`, a ternary, a member expression) is
      //     allowed. Guessing at arithmetic produces noise rather than signal.
      //  3. Tier detection is FILE-scoped: a file calling both the reasoning-tier
      //     function and a cheaper-tier one has the cheap tier's cap reported too.
      //     The false positive is the safe direction, and the fix is to split the
      //     file.
      //
      // WHAT WOULD DISARM THIS RULE: moving a cap behind an import (blind spot 1),
      // or renaming the tier function without updating `tierFunction`. A model
      // swap that makes the tier non-reasoning makes the rule unnecessary rather
      // than wrong — retire it deliberately, do not weaken it.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/quality-model-token-floor.md",
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
            tierFunction: { type: "string", minLength: 1 },
            floorIdentifier: { type: "string", minLength: 1 },
            capProperty: { type: "string", minLength: 1 },
          },
          required: ["tierFunction", "floorIdentifier"],
          additionalProperties: false,
        },
      ],
    },
    messages: {
      literalCap: `{{capProperty}} is set to a number at a {{tierFunction}} call site. ${ADVICE}`,
      localLiteralCap: `{{capProperty}} is set to "{{name}}", a local constant bound to a number, at a {{tierFunction}} call site. ${ADVICE}`,
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const { tierFunction, floorIdentifier } = options;
    const capProperty = options.capProperty ?? DEFAULT_CAP_PROPERTY;
    const data = { tierFunction, floorIdentifier, capProperty };

    let usesQualityModel = false;
    /** @type {Map<string, import("estree").Expression>} name -> const initializer */
    const localConsts = new Map();
    /** @type {import("estree").Property[]} */
    const capProperties = [];

    return {
      Identifier(node) {
        if (node.name === tierFunction) usesQualityModel = true;
      },

      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || node.init === null) return;
        // Last declaration wins, matching how a reader resolves the name.
        localConsts.set(node.id.name, node.init);
      },

      Property(node) {
        if (isCapProperty(node, capProperty)) capProperties.push(node);
      },

      "Program:exit"() {
        if (!usesQualityModel) return;
        for (const property of capProperties) {
          const verdict = classify(property.value, localConsts, floorIdentifier);
          if (verdict === "literal") {
            context.report({ node: property, messageId: "literalCap", data });
          } else if (verdict === "local-literal") {
            context.report({
              node: property,
              messageId: "localLiteralCap",
              data: { ...data, name: property.value.name },
            });
          }
        }
      },
    };
  },
};
