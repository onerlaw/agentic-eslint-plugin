# Convert the plugin to TypeScript

**Status:** Draft
**Date:** 2026-08-21

## Goal

Author `src/` and `tests/` in TypeScript, publish compiled ESM plus type declarations from
`dist/`, and keep every existing gate green with rule behavior unchanged.

## Why

The rules are ESTree shape-matching code — `node.key?.type === "Identifier"`,
`binding?.defs?.[0]?.node`, `value?.type === "Literal" && typeof value.value === "number"`.
Getting a node shape wrong is this codebase's most likely defect class, and it is exactly
what a compiler catches. That is the same argument the README makes for the rules
themselves: mechanize the failure that review keeps missing.

Consumers currently receive no type declarations at all. After this change they get
`.d.ts` for the plugin's export surface without installing anything beyond the `eslint`
peer they already have.

## Approach

**Typing.** A ~30-line `src/define-rule.ts` is the only new abstraction:

- `defineRule<TOptions, TMessageIds>` returns ESLint's own `Rule.RuleModule`, so nothing
  from the helper reaches consumers' `.d.ts`.
- Its `Visitor` type is derived from the `TSESTree.Node` union, giving every node type —
  **including JSX** — a typed handler and a typed `:exit` counterpart. `:exit` is
  generated for every node type rather than special-casing `Program:exit`, so the next
  `"VariableDeclaration:exit"` does not silently degrade to `any`.
- Exactly one unchecked seam exists: `create as unknown as Rule.RuleModule["create"]`,
  bridging the authoring type to ESLint's looser runtime type. It is contained to this
  file and named in a comment.
- Known limit, stated rather than overclaimed: an **extra unused key** in `messages` is
  not rejected. A missing declared key and a `report()` id outside the union both are.
- There is deliberately **no `defaultOptions`**: the four required-options rules use a full
  array schema with `minItems: 1` so that enabling them unconfigured is a config error, not
  a silent no-op. Options are typed, never defaulted.
- `src/breakpoint-guard.ts` is not a rule module and does not use `defineRule`; its four
  named exports take `TSESTree`-typed parameters directly.

**New devDependencies — the complete list.** `typescript`, `jiti` (required for ESLint's
flat-config loader to import `eslint.config.ts`), and `@typescript-eslint/types` (imported
with `import type` only, therefore erased at build). All three are already present
transitively; this promotes them to declared devDependencies. No `@types/eslint` is
needed — `Rule.RuleModule` comes from ESLint 9's own bundled type declarations. **Runtime dependencies stay
at zero** — `package.json` gains no `dependencies` key.

**Two tsconfigs, because one cannot do both jobs.** Verified: a single config with
`rootDir: src` that also includes `tests/` fails `TS6059` *even under `--noEmit`*.

- `tsconfig.json` — broad, `noEmit: true`, includes `src/`, `tests/`, and root-level
  `*.ts` config files. Backs `npm run typecheck`, so type errors in tests are caught.
- `tsconfig.build.json` — extends it, `rootDir: src`, `outDir: dist`, `declaration: true`,
  includes only `src/**/*.ts`. Backs `npm run build`; tests are excluded from emit.

No `declarationMap` or `sourceMap`: `src/` is not published, so map files would point at
sources absent from the tarball.

**Packaging.** `main`/`exports`/`types` point at `dist/`; `files: ["dist", "README.md", "LICENSE"]`.
`"prepare": "npm run build"` — verified as the hook that guarantees `dist/` exists: with
`dist/` deleted, `npm pack` fired `prepare`, rebuilt it, and the tarball contained it.
`prepublishOnly` does not fire on pack and would not cover git-URL installs.
`eslint.config.ts` imports `./src/index.ts` via jiti, so `eslint .` still passes on a clean
checkout **with no build** — the property the old "no build step" note actually protected.

**Both CI workflows gain the typecheck step.** `ci.yml` and `release.yml` each carry their
own hand-duplicated `test` job, and `release.yml`'s copy is what `release: needs: test`
gates the OIDC auto-publish on. Its own comment explains why the duplication exists: "a tag
that rode a broken release cannot be cleanly withdrawn." Adding `npm run typecheck` to only
`ci.yml` would leave the publish gate weaker than the PR gate — the exact failure that
comment guards against. Both are updated.

**Docs.** The README's "No build step, on purpose" note and CONTRIBUTING's matching claim
are rewritten to state what is now true, including that clean-checkout linting still works.

## Success criteria

1. No `.js` remains under `src/`; `src/**/*.ts` covers `index`, `define-rule`, `breakpoint-guard`, and all 10 rules.
2. All 12 test suites are `.ts`; `npm test` reports **154 passing tests in 12 files** — the captured pre-conversion baseline.
3. `npm run typecheck` exits 0 under `strict: true`, and its config includes `tests/` (a deliberate type error in a test must fail it).
4. `npm run build` emits `dist/index.js` + `dist/index.d.ts`, `dist/breakpoint-guard.*`, and `dist/rules/*.{js,d.ts}` for all 10 rules, and emits nothing for `tests/`.
5. `npm run lint` exits 0 on a clean checkout with **no** prior build.
6. `npm pack --dry-run` lists `dist/` and no `.ts`; `main`, `exports`, and `types` resolve to files present in the tarball.
7. `npm run verify:pack` — a committed script, not a one-off: packs the tarball, installs it into a temp dir, asserts all 10 rules are exposed, lints a fixture that reports, **and type-checks a TypeScript consumer file with `tsc`**. It carries a negative control (assigning a `string` field to `number` must fail) so a resolution that silently degrades to `any` cannot pass vacuously.
8. **Both** `.github/workflows/ci.yml` **and** `.github/workflows/release.yml` run `npm run typecheck` **and** `npm run verify:pack` in their `test` job, on node 20 and 22, and both pass. Criteria 6 and 7 are thereby permanent gates on every future PR and every release, not checks performed once during this conversion.
9. README's "No build step, on purpose" note and CONTRIBUTING's matching claim are rewritten.
10. Rule behavior unchanged: existing assertions pass with only syntax/type edits, no semantic changes. The two pinned polarities are untouched — `tamagui-native-id` stays default-deny, `responsive-two-pane-flex` keeps file-scoped detection.
11. `tests/required-options.test.ts` passes unmodified in substance — the 4 rules still throw when enabled unconfigured.
12. `tests/docs-parity.test.ts` passes — all 10 `meta.docs.url` values resolve, no orphan pages.
13. The PR states whether a `BREAKING CHANGE:` footer is warranted, and states the first-release strategy.

## Open questions

Both now carry a default, so implementation is never blocked on them:

- **`engines.node`** — default: keep `>=20`. Note the earlier draft justified this with
  "the build never runs in the consumer's environment", which is **wrong**: `prepare` fires
  on git-URL installs, so `npm install github:onerlaw/agentic-eslint-plugin` does run `tsc`
  on the installer's machine. The correct reasoning is narrower — registry installs (the
  overwhelmingly common path) consume prebuilt `dist/` and never compile, and for the
  git-URL path TypeScript 6 supports Node 20 fine. So `>=20` remains accurate for every
  install path; it is simply not true that no consumer ever builds.
- **First release channel** — default: publish direct to `latest`. Criterion 7's real
  tarball install is the substantive gate, and a `next` canary would require editing
  `.releaserc.json`'s branch config — adding unreviewed moving parts to the release
  pipeline, the riskiest surface here — and would leave `latest` stale until a human
  promoted it, which an autonomous run cannot guarantee.
