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
gates on the test job, then runs semantic-release to version, tag, publish to npm, and
cut a GitHub Release.

Authentication is **npm trusted publishing (OIDC)** — there is no `NPM_TOKEN` secret.
The job's `id-token` is exchanged for a short-lived credential at publish time, and
provenance is generated automatically.

### Operator setup (one time)

npm cannot do the **first** publish over OIDC. A trusted publisher is configured on a
package, and the package must already exist — `npm trust`'s own prerequisites say so, and
[npm/cli#8544](https://github.com/npm/cli/issues/8544) (allow the initial publish over
OIDC, as PyPI does) is still open. The registry says so plainly:
`404 OIDC token exchange error - package not found`.

So the first release uses a token, and every release after it uses OIDC. The workflow
already handles both — it tries OIDC first and falls back to `NPM_TOKEN` only if that
fails, so switching over is deleting a secret, not editing code.

1. **Own the scope.** An npm **Organization** named `onerlaw` must exist
   (<https://www.npmjs.com/org/create>). Free for public packages.
2. **Mint a bootstrap token.** npmjs.com → Access Tokens → Generate New Token →
   **Granular Access Token**, with **read and write** on the `@onerlaw` scope.
   A Classic **Automation** token also works. A Classic **Publish** token does **not** —
   npm still demands a 2FA one-time password for it and CI fails with `EOTP`.
3. **Store it.** Repo → Settings → Secrets and variables → Actions → `NPM_TOKEN`.
4. **Release.** Merge to `main`, or re-run the Release workflow. This publishes the
   first version using the token.
5. **Configure trusted publishing** now that the package exists — in the package's
   settings on npmjs.com ("Trusted Publisher"), or from the CLI (npm >= 11.15.0):
   ```sh
   npm trust github @onerlaw/agentic-eslint-plugin \
     --file release.yml --repo onerlaw/agentic-eslint-plugin --allow-publish
   ```
6. **Delete the `NPM_TOKEN` secret and revoke the token.** The next run finds no token,
   uses OIDC, and the repo holds no standing credential.

### Why there is no token

A long-lived publish token is a standing credential with nothing rotating it. Trusted
publishing removes it entirely. The one cost is the manual first publish above.

If you ever do fall back to a token, note that a Classic **Publish** token is *not*
enough — npm still demands a 2FA one-time password for it and CI fails with `EOTP`. Only
a **Granular Access Token** or a Classic **Automation** token bypasses 2FA.

### If a release fails

semantic-release pushes the version tag **before** it publishes, so a failed publish
leaves a tag pointing at a version that was never released. The next run then reads that
tag as "already released" and reports no new version — the release wedges silently.

The workflow's last step handles this: on failure it checks whether the tag's version
actually reached the registry, and deletes the tag if it did not. If you ever need to do
it by hand:

```sh
git push origin :refs/tags/vX.Y.Z
gh release delete vX.Y.Z --yes   # if one was created
```

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
