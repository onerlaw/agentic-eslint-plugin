import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/quality-model-token-floor.js";

const F = "packages/api/src/services/career-chat/stream-career-chat-answer.ts";
const OPTIONS = [{ tierFunction: "getApiQualityModel", floorIdentifier: "REASONING_MAX_TOKENS_FLOOR" }];

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

// The import line every QUALITY call site carries. Kept as a fragment so each
// case reads as the delta from a real file rather than a synthetic snippet.
const QUALITY_IMPORT = 'import { getApiQualityModel } from "../llm/model-ids.js";';

ruleTester.run("quality-model-token-floor", rule, {
  valid: [
    {
      options: OPTIONS,
      name: "the canonical spelling — the floor identifier used directly",
      filename: F,
      code: `${QUALITY_IMPORT}
import { REASONING_MAX_TOKENS_FLOOR } from "../llm/reasoning-token-budget.js";
const req = { model: getApiQualityModel(), max_tokens: REASONING_MAX_TOKENS_FLOOR };`,
    },
    {
      options: OPTIONS,
      // request-rewrite-attempt.ts's real shape. One level of local indirection,
      // bound to the floor rather than a number — correct, and must not be flagged.
      name: "local const bound to the floor",
      filename: F,
      code: `${QUALITY_IMPORT}
import { REASONING_MAX_TOKENS_FLOOR } from "../llm/reasoning-token-budget.js";
const REWRITE_MAX_TOKENS = REASONING_MAX_TOKENS_FLOOR;
const req = { model: getApiQualityModel(), max_tokens: REWRITE_MAX_TOKENS };`,
    },
    {
      options: OPTIONS,
      // chat-edit-constants.ts's real shape, and blind spot #1: a single-file
      // rule cannot follow the import to see what it is bound to.
      name: "imported alias is allowed — the documented blind spot",
      filename: F,
      code: `${QUALITY_IMPORT}
import { EDIT_PROPOSAL_MAX_TOKENS } from "./chat-edit-constants.js";
const req = { model: getApiQualityModel(), max_tokens: EDIT_PROPOSAL_MAX_TOKENS };`,
    },
    {
      options: OPTIONS,
      name: "a numeric cap in a FAST-tier file is out of scope",
      filename: "packages/api/src/services/career-profile/llm/generate-merge-ops.ts",
      code: `import { getApiFastModel } from "../../llm/model-ids.js";
const CAREER_PROFILE_MERGE_MAX_TOKENS = 8192;
const req = { model: getApiFastModel(), max_tokens: CAREER_PROFILE_MERGE_MAX_TOKENS };`,
    },
    {
      options: OPTIONS,
      name: "a numeric cap in a JUDGE-tier file is out of scope",
      filename: "packages/api/src/services/resume-ats/ai-scan/run-judge.ts",
      code: `import { LLM_MODEL_JUDGE } from "../../llm/model-ids.js";
const JUDGE_MAX_TOKENS = 4096;
const req = { model: LLM_MODEL_JUDGE, max_tokens: JUDGE_MAX_TOKENS };`,
    },
    {
      options: OPTIONS,
      name: "a non-cap property named something else is untouched",
      filename: F,
      code: `${QUALITY_IMPORT}
const req = { model: getApiQualityModel(), temperature: 0 };`,
    },
  ],

  invalid: [
    {
      options: OPTIONS,
      // THE SHIPPED BUG, byte-for-byte in shape. This is the case a rule that
      // only banned inline literals would have passed — repo-wide, the pattern
      // `max_tokens: <number>` had zero occurrences.
      name: "local const bound to a number — the spelling that shipped",
      filename: F,
      code: `${QUALITY_IMPORT}
const CAREER_CHAT_ANSWER_MAX_TOKENS = 700;
const req = { model: getApiQualityModel(), max_tokens: CAREER_CHAT_ANSWER_MAX_TOKENS };`,
      errors: [{ messageId: "localLiteralCap" }],
    },
    {
      options: OPTIONS,
      name: "inline numeric literal",
      filename: F,
      code: `${QUALITY_IMPORT}
const req = { model: getApiQualityModel(), max_tokens: 700 };`,
      errors: [{ messageId: "literalCap" }],
    },
    {
      options: OPTIONS,
      name: "a generous inline number is still wrong — the policy is one value, not a threshold",
      filename: F,
      code: `${QUALITY_IMPORT}
const req = { model: getApiQualityModel(), max_tokens: 65536 };`,
      errors: [{ messageId: "literalCap" }],
    },
    {
      options: OPTIONS,
      name: "quoted key spelling is caught too",
      filename: F,
      code: `${QUALITY_IMPORT}
const req = { model: getApiQualityModel(), "max_tokens": 700 };`,
      errors: [{ messageId: "literalCap" }],
    },
    {
      options: OPTIONS,
      name: "the call site need not be adjacent — file scope is what marks the tier",
      filename: F,
      code: `${QUALITY_IMPORT}
const MODEL = getApiQualityModel();
const CAP = 512;
export function build() {
  return { model: MODEL, max_tokens: CAP };
}`,
      errors: [{ messageId: "localLiteralCap" }],
    },
  ],
});
