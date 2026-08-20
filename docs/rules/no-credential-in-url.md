# `no-credential-in-url`

Ban credentials embedded in a URL's userinfo component — `scheme://user:secret@host`.

## Why

Git persists the credential from a clone URL into `.git/config` as the remote. From
that moment `git remote -v`, any tool that echoes remotes, and any log that captures
one will hand out a working token. The URL form is usually buying nothing, too — most
tooling reads its token from the environment or a credential helper regardless.

The shape is easy to write, and it survives review because it reads like configuration.

## What it catches

```js
// ✗
const remote = `https://x-access-token:${GITHUB_PAT}@github.com/acme/repo.git`;
const db = "postgresql://admin:hunter2@db.example.net:5432/app";

// ✓ — secret passed out of band
const remote = "https://github.com/acme/repo.git";
// ✓ — unreachable host, so it is a fixture rather than a leak
const db = "postgresql://app:pw@localhost:5432/app_test";
```

Three forms are recognised, including credentials split across a template literal's
parts: `https://user:` + `${TOKEN}` + `@host`, and the shape where the *host itself*
is the interpolation (`https://x-access-token:${TOKEN}@` + `${suffix}`). That last one
is the riskiest form, not the safest — a credential aimed at a host chosen at runtime.

## Options

None.

## Polarity and bias

Default-deny on any userinfo credential aimed at a routable host, with an escape for
local and RFC-2606 reserved hosts (`localhost`, `127.0.0.1`, `*.example.com`, `.test`,
`.invalid`). Biased hard against false positives: a noisy secret rule gets suppressed,
and a suppressed rule reads as coverage while providing none.

A printf conversion in the secret position (`https://user:%s@host`) is exempt. That is
git's own credential-store line format — literally the remedy this rule's message
prescribes — so flagging it would make the rule fire on the fix. The exemption is for
the *format*, not the file: reintroducing `:${TOKEN}@` in the same file is still an error.

## Known blind spots

1. A URL assembled by concatenation (`base + ":" + token + "@" + host`) is invisible.
   Only literals and template literals are inspected. The shape this exists to stop is
   the readable one-liner.
2. It cannot tell a real token from a fake one at a routable host, so a realistic-looking
   fixture needs a local or reserved host. That is the correct bias — the rule should not
   be in the business of judging whether a secret is live.
3. TS/JS only. A credentialed URL in a `.yml`, `.sql` or `.env` is out of ESLint's reach.
   If you pair this with a non-JS secret scanner, keep the two exclusion lists in
   agreement, or a string moved between file types changes verdict.

## Config

```js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: { agentic },
    rules: { "agentic/no-credential-in-url": "error" },
  },
];
```
