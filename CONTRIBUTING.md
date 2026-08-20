# Contributing

## Development

```sh
npm install
npm test         # vitest + ESLint RuleTester
npm run lint     # this package lints itself with its own rules
```

Plain ESM JavaScript, no build step. `main` points at source deliberately — see the
README.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). The commit
type determines the release:

| Type | Release |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major |
| `chore:`, `docs:`, `test:`, `refactor:`, `ci:` | none |

The repo is **squash-merge only**. GitHub uses the PR title as the squash commit subject,
so the PR title is what semantic-release reads — CI lints it, and the branch commits, with
`commitlint`.

## Adding a rule

1. Write it in `src/rules/<name>.js` and register it in `src/index.js`.
2. Put its **why**, its **polarity / false-positive bias**, and its **known blind spots**
   in `meta.docs`, inline. That record belongs where the next reader will see it.
3. Point `meta.docs.url` at `docs/rules/<name>.md` and write that page.
   `tests/docs-parity.test.js` enforces both directions — a rule with no page, and a page
   with no rule, both fail.
4. If the rule needs project-specific identifiers, make them **options**. If no universal
   default exists, use a full array schema with `minItems: 1` so omitting options is a
   config error rather than a silent no-op, and add a case to
   `tests/required-options.test.js`.
5. Give it its own flat-config block in the README recipe, matching the file set it must
   cover. Reusing another rule's block silently unguards whatever that block ignores.

### Verifying a rule actually catches what it claims

RuleTester cases cannot prove this on their own — **you write them**, so a suite written
from a misunderstanding passes cleanly against that misunderstanding. Verify in three
layers:

1. RuleTester cases for the boundaries.
2. **Reintroduce the real defect into a real file**, confirm the rule fires at the right
   `file:line`, and restore. This layer is the load-bearing one.
3. Run it across a live tree and triage every finding. A ported or generalized rule is
   often *stricter* than the thing it replaced.

## Releasing

Releases are automatic: merging to `main` runs `.github/workflows/release.yml`, which
gates on the test job, then runs semantic-release to version, tag, publish to npm with
provenance, and cut a GitHub Release.

### Operator setup (one time)

The release job **skips itself** with a notice when `NPM_TOKEN` is absent — it does not
tag first and fail at publish, because a tag that rode a failed release cannot be cleanly
withdrawn. To enable publishing:

1. **Own the scope.** Create an npm **Organization** named `onerlaw`
   (<https://www.npmjs.com/org/create>). Free for public packages. A user-scoped
   `@onerlaw` also works only if the npm *username* is `onerlaw`.
2. **Mint a token.** npm → Access Tokens → Generate → **Granular Access Token**, with
   read/write on `@onerlaw/*`. A Classic "Automation" token also works.
3. **Store it.** Repo → Settings → Secrets and variables → Actions → New repository
   secret, named `NPM_TOKEN`.
4. Re-run the release workflow, or merge anything to `main`.

If the token exists but the scope is not owned, the publish fails with **402/403** rather
than skipping. That is the likeliest first-run failure: fix it at step 1, not by
re-minting the token.

`GITHUB_TOKEN` is provided by Actions automatically; no setup needed.

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
