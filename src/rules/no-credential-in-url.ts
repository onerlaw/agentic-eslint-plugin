import { defineRule } from "../define-rule.js";

// `scheme://user:secret@host`. The secret half must be non-empty and must not
// be a shell/JS interpolation of a *placeholder* — an interpolation is exactly
// the case we want to catch, so `${TOKEN}@` is handled by the seam check below
// rather than here.
const CREDENTIAL_IN_URL = /:\/\/[^\s:@/]+:(?<secret>[^\s@/]+)@[A-Za-z0-9.-]+/;

// A printf conversion as the secret means the value is supplied as an argument
// to a format string, not embedded in a URL anything will dereference. That is
// how git's credential store is written — its line format is literally
// `https://user:secret@host`, i.e. the remedy this rule's own message
// prescribes — so flagging it would make the rule fire on the fix.
//
// Deliberately narrow: it exempts the FORMAT, not the file. Reintroducing
// `:${GITHUB_PAT}@` in the same file is still an error, which matters because
// that file is where the incident happened.
const PRINTF_PLACEHOLDER = /^%[-#0 +']*[\d.*]*[a-zA-Z]$/;

// The tail of a quasi that ends mid-credential: `://user:` immediately before
// an interpolation. Paired with a following quasi that starts with `@`, that is
// `https://x-access-token:${TOKEN}@host` split across the template's parts.
const OPEN_CREDENTIAL = /:\/\/[^\s:@/]+:$/;

// A complete credential whose HOST is the interpolation:
// `https://x-access-token:${GITHUB_PAT}@` + `${repoUrlSuffix}`.
// This is the shape that actually shipped, and the first version of this rule
// missed it — CREDENTIAL_IN_URL requires a host after the `@`, and here there
// is none until the next expression. No local/reserved exclusion applies: an
// unknown host cannot be proven harmless, and a credential aimed at a host
// chosen at runtime is the riskiest form, not the safest.
const CREDENTIAL_WITH_INTERPOLATED_HOST = /:\/\/[^\s:@/]+:(?<secret>[^\s@/]+)@$/;

// A host nobody can reach is a fixture, not a leak. If you pair this rule with
// a non-JS secret scanner, keep the two exclusion lists in agreement — else a
// string moved between a source file and a config file changes verdict.
const LOCAL_OR_RESERVED =
  /@(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1|host\.docker\.internal|(?:[A-Za-z0-9-]+\.)*(?:example\.(?:com|org|net)|example|test|invalid|localhost))(?:[:/]|$)/;

function flagsAsCredential(text: string): boolean {
  const match = CREDENTIAL_IN_URL.exec(text);
  if (match === null) return false;
  if (PRINTF_PLACEHOLDER.test(match.groups?.secret ?? "")) return false;
  return !LOCAL_OR_RESERVED.test(text);
}

function flagsAsInterpolatedHostCredential(text: string): boolean {
  const match = CREDENTIAL_WITH_INTERPOLATED_HOST.exec(text);
  if (match === null) return false;
  return !PRINTF_PLACEHOLDER.test(match.groups?.secret ?? "");
}

export default defineRule<never, "credentialInUrl">({
  meta: {
    type: "problem",
    docs: {
      description: "Ban credentials embedded in a URL's userinfo component.",
      // WHY: a credential in a clone URL is persisted by git into `.git/config`
      // as the remote. `git remote -v`, any tool that echoes remotes, and any
      // log capturing one then hand out a working token. The shape is easy to
      // write, survives review because it looks like configuration, and is
      // usually buying nothing — most tooling reads the token from the
      // environment or a credential helper anyway.
      //
      // NO STOCK EQUIVALENT EXISTS. Secret scanners (gitleaks, trufflehog) match
      // committed file CONTENT and would flag the same string, but they are a
      // separate tool with separate wiring. This is the ESLint half, and it
      // covers only what ESLint can see — TS/JS source.
      //
      // POLARITY: default-deny on any userinfo credential aimed at a routable
      // host, with a fixture escape via local/RFC-2606 hosts only. Biased hard
      // against false positives — a noisy secret rule gets suppressed, and a
      // suppressed rule reads as coverage while providing none.
      //
      // KNOWN BLIND SPOTS:
      //  1. A URL assembled by concatenation (`base + ":" + token + "@" + host`)
      //     is invisible — only literals and template literals are inspected.
      //     Accepted: the shape this exists to stop is the readable one-liner.
      //  2. It cannot tell a real token from a fake one at a routable host, so a
      //     realistic-looking fixture needs a local/reserved host. That is the
      //     correct bias: the rule should not be in the business of judging
      //     whether a secret is live.
      //  3. TS/JS only. A credentialed URL in a `.yml`, `.sql` or `.env` is out
      //     of ESLint's reach entirely.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/no-credential-in-url.md",
    },
    schema: [],
    messages: {
      credentialInUrl:
        "credential embedded in a URL — git persists it into .git/config and " +
        "every tool that prints the remote leaks it. Pass the secret out of " +
        "band (a mode-600 credential-store file, or a credential helper).",
    },
  },

  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (flagsAsCredential(node.value)) {
          context.report({ node, messageId: "credentialInUrl" });
        }
      },

      TemplateLiteral(node) {
        // A credential wholly inside one quasi — including the shell-level
        // `\${VAR}` form, which reaches the AST as literal `${VAR}` text — or
        // one whose host is the next interpolation.
        for (const quasi of node.quasis) {
          const text = quasi.value.cooked ?? quasi.value.raw ?? "";
          if (flagsAsCredential(text) || flagsAsInterpolatedHostCredential(text)) {
            context.report({ node, messageId: "credentialInUrl" });
            return;
          }
        }
        // A credential split across an interpolation: `://user:` then `${x}`
        // then `@host`. This is the JS-level form of the same mistake, and the
        // per-quasi scan above cannot see it.
        for (let i = 0; i < node.quasis.length - 1; i += 1) {
          const before = node.quasis[i]?.value.cooked ?? "";
          const after = node.quasis[i + 1]?.value.cooked ?? "";
          if (OPEN_CREDENTIAL.test(before) && after.startsWith("@")) {
            if (LOCAL_OR_RESERVED.test(after)) continue;
            context.report({ node, messageId: "credentialInUrl" });
            return;
          }
        }
      },
    };
  },
});
