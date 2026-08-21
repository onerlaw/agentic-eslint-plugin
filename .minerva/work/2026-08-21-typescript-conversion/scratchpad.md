# Scratchpad — 2026-08-21-typescript-conversion

Working notes for the TypeScript conversion. Durable findings get promoted to
`.minerva/knowledge/` at the end; the rest is discarded.

## Panel decisions 2026-08-21

- [3/3 accept] scope check: single work unit (Skeptic accepted, logging 3 follow-ups: capture a pre-conversion baseline, commit an npm lifecycle-hook default, consider a canary dist-tag — all three closed before implementation)
- [3/3 accept, round 2] approach selection: C′ — `defineRule` helper + type-only TSESTree types, zero runtime deps. Round 1 failed 2/3: the Skeptic proved bare `Rule.RuleModule` yields `TS7006` implicit-any on every JSX handler, so the original pick gave ZERO safety on the 4 most AST-sensitive files. Rejected: A (bare `Rule.RuleModule`, dominated) and B (`ESLintUtils.RuleCreator`, adds the first runtime dependency).
- [3/3 accept, round 2] whole-proposal acceptance. Round 1 failed 2/3 on a HIGH finding: `release.yml` carries its own duplicated `test` job that gates the OIDC publish, so adding typecheck to only `ci.yml` would leave the publish gate weaker than the PR gate. Both workflows now bound by criterion 8.

### Concerns logged but not blocking (audit trail for review/promote)

- `engines.node` justification was internally contradictory — `prepare` DOES fire on git-URL installs, so a consumer can build. Corrected in the proposal rather than papered over.
- Criteria 6/7 were one-off checks; promoted to a committed `verify:pack` script wired into both workflows.
- Type consumability was ungated despite being the headline deliverable; `verify:pack` now type-checks a TS consumer with a negative control.
- The `types`-condition ordering hazard was investigated and does NOT reproduce on TypeScript 6.0.3 + NodeNext (verified: resolves types-first, types-last, and with a bare string `exports`). `types` is still placed first as it costs nothing.

## Pre-conversion baseline (captured on `main` before any edit)

- `npm test` → **12 test files, 154 tests, all passing**
- `npm run lint` → exit 0
- `src/`: 12 `.js` files (index, breakpoint-guard, 10 rules); `tests/`: 12 `.test.js`; `docs/rules/`: 10 pages

## Spike findings carried in from the design phase

- `tsc` NodeNext + `strict` + `declaration` compiles rule modules with **zero** new runtime deps; `Rule.RuleModule` comes from ESLint 9's own bundled types (no `@types/eslint`).
- `eslint.config.ts` importing `./src/index.ts` loads via jiti — `eslint .` works on a clean checkout with no build.
- vitest runs `.test.ts` against TS source with `RuleTester`.
- `context.report({ data })` is typed `Record<string, string>` — numeric `data: { count }` must become `String(count)`.
- `"prepare": "npm run build"` verified: with `dist/` deleted, `npm pack` fired it, rebuilt `dist/`, and the tarball contained it. `prepublishOnly` did not fire on pack.
- One tsconfig cannot both emit from `rootDir: src` and typecheck `tests/` — `TS6059` even under `--noEmit`. Two configs required.

## Notes

### Implementation notes (2026-08-21)

The compiler surfaced 58 errors on first pass. Most were plain annotations on private
helpers, but four were substantive and are worth recording:

1. **JSX handlers were untyped `any`.** Confirmed the design-phase finding in the real
   code, not just a spike — `tamagui-native-id`, `responsive-two-pane-flex`,
   `workspace-chrome-flex` and `breakpoint-guard` all key on JSX nodes.
2. **`data: { count }` / `data: { factor }` passed numbers** where ESLint's
   `ReportDescriptor` wants `Record<string, string>`. Two real call sites, both now
   `String(...)`. This was the gotcha the spike predicted.
3. **ESLint's API types are estree-based, TSESTree is a superset**, so the two disagree
   at `getScope`, `getAllComments` and `getText`. Bridged ONCE in `define-rule.ts`
   (`BridgedSourceCode`) rather than casting in each rule — the whole point of the helper
   is to keep seams contained.
4. **`noUncheckedIndexedAccess` caught unguarded `node.quasis[i]` indexing** in
   `no-credential-in-url`'s split-credential scan.

Two narrowings preserve behavior exactly rather than changing it, and say so inline:
`classify()` only ever returns `"local-literal"` for an Identifier value, and
`specifier.imported` is `Identifier | StringLiteral` where only the Identifier form could
ever have matched the old `?.name` access.

`commitlint.config.js` stays JavaScript — commitlint loads it without a TS loader, and it
is two lines. Consequence: the ESLint config now matches `**/*.ts`, so that one file is no
longer linted. Noted rather than hidden.
