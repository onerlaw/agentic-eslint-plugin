## What

Author the plugin in TypeScript and publish compiled output. `src/` and `tests/` are now
`.ts`; `tsc` emits ESM plus type declarations to `dist/`, and `main`/`exports`/`types`
point there. Consumers get `.d.ts` for the first time.

## Why the "no build step, on purpose" note is gone

The README argued `main` should point at source because "a plugin whose entry pointed at
compiled output breaks any gate that runs `eslint .` on a clean checkout without building
first." That was right about the property worth protecting and wrong that shipping source
was the only way to hold it. `eslint.config.ts` imports `./src/index.ts` **directly**, so
`eslint .` still passes on a clean checkout with no build. Both the README note and
CONTRIBUTING's matching claim are rewritten rather than quietly falsified.

## What the compiler caught

Three real defects, which is the case for doing this at all:

1. `data: { count }` and `data: { factor }` passed **numbers** where ESLint's
   `ReportDescriptor` requires `Record<string, string>` — two live call sites.
2. `node.quasis[i]` was indexed **unguarded** in `no-credential-in-url`'s
   split-credential scan.
3. JSX handlers in `tamagui-native-id`, `responsive-two-pane-flex`, `workspace-chrome-flex`
   and `breakpoint-guard` would have been silently `any` under naive typing — ESLint's
   bundled types are vanilla ESTree with no JSX variants. `src/define-rule.ts` derives its
   visitor from the full TSESTree node union instead.

## Dependency impact: none

`@typescript-eslint/types` and `@types/node` are **devDependencies**, imported type-only
and erased at build. `package.json` still has no `dependencies` key, and `verify:pack`
asserts that against the packed tarball on every run.

## Release: BREAKING CHANGE, direct to `latest`

The commit carries a `BREAKING CHANGE:` footer, so semantic-release will cut **v1.0.0**
rather than a minor. That is the honest classification: `main` and `exports` no longer
resolve to `src/`. Registry consumers are unaffected — the tarball ships `dist/` — but
anything deep-importing a `src/` path, or consuming this package straight from a git
checkout without building, must change.

**First release goes direct to `latest`, not a `next` canary.** A canary would require
editing `.releaserc.json`'s branch config — adding unreviewed moving parts to the
riskiest surface in this change — and would leave `latest` stale until someone promoted
it by hand. The substantive gate is `npm run verify:pack`, which packs the real tarball,
installs it into a throwaway consumer, and checks the package both runs and type-checks
from the installed artifact, with a negative control so it cannot pass by resolving types
to `any`.

## Verification

| Gate | Result |
|---|---|
| `npm test` | 12 files, 154 tests — identical to the pre-conversion baseline |
| `npm run typecheck` | clean under `strict`, covering `src/` + `tests/` + root configs |
| `npm run build` | 13 `.js` + 13 `.d.ts`, 10 rules, nothing emitted for `tests/` |
| `npm run lint` | exit 0 with **no** `dist/` present |
| `npm run verify:pack` | 13/13 including the negative control |

Both `ci.yml` and `release.yml` gain `typecheck` and `verify:pack`. `release.yml` carries
its own duplicated `test` job that gates the OIDC publish, so updating only `ci.yml` would
have left the publish gate weaker than the PR gate — the exact failure that file's own
comment warns about.

## Known limits, stated rather than glossed

- One deliberate unchecked seam: `create as unknown as Rule.RuleModule["create"]` in
  `define-rule.ts`, contained to that line.
- An extra **unused** key in a rule's `messages` is not rejected by the types. A missing
  declared key and an out-of-union `report()` id both are.
- `commitlint.config.js` stays JavaScript (commitlint loads it without a TS loader), so it
  is no longer covered by ESLint, whose config now matches `**/*.ts`.
