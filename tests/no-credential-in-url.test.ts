/**
 * Fixtures for `no-credential-in-url`.
 *
 * biome.json carries a per-file override turning off
 * `suspicious/noTemplateCurlyInString` for this path. The fixtures are SOURCE
 * CODE stored as strings, so a literal `${...}` is the thing under test rather
 * than a mistake — and an inline `biome-ignore` is banned by
 * `no-biome-ignore`, whose whole point is that the exemption should
 * land somewhere a reviewer sees it. The override is scoped to this one file so
 * it expires with the file that needs it.
 *
 * These fixtures are also exempted, by name, in the ESLint config block and in
 * packages/pipeline/conventions/test_no_committed_secrets.py's ALLOWLIST: the
 * invalid cases below ARE credentials by construction.
 */
import tsParser from "@typescript-eslint/parser";
import { RuleTester } from "eslint";
import rule from "../src/rules/no-credential-in-url.js";

const ruleTester = new RuleTester({ languageOptions: { parser: tsParser } });

ruleTester.run("no-credential-in-url", rule, {
  valid: [
    { name: "a plain URL", code: 'const u = "https://github.com/acme/repo.git";' },
    {
      name: "userinfo with no secret",
      code: 'const u = "https://token@github.com/o/r.git";',
    },
    {
      name: "a local dev DSN is a fixture, not a leak",
      code: 'const u = "postgresql://app:pw@localhost:5432/app_test";',
    },
    {
      name: "an RFC 2606 reserved host is a fixture",
      code: 'const u = "http://user:hunter2@proxy.example.com:12321";',
    },
    {
      name: "an interpolated secret aimed at localhost",
      code: "const u = `postgresql://app:${pw}@localhost:5432/db`;",
    },
    {
      name: "a colon in a path is not userinfo",
      code: 'const u = "https://github.com/o/r/blob/main/a:b";',
    },
    {
      name: "concatenation is a documented blind spot, not a false positive",
      code: 'const u = "https://x:" + token + "@github.com";',
    },
    {
      // git's credential-store line format IS `https://user:secret@host`, so
      // flagging this would make the rule fire on its own prescribed remedy.
      name: "a printf format whose secret arrives as an argument",
      code: "const s = `printf 'https://x-access-token:%s@github.com\\\\n' \"$TOKEN\" > /root/.git-credentials`;",
    },
    {
      name: "the same, with the host interpolated",
      code: "const s = `printf 'https://x-access-token:%s@${repoHost}\\\\n' \"$TOKEN\" > ~/.git-credentials`;",
    },
  ],
  invalid: [
    {
      // The shape that shipped: a shell-level ${VAR} inside a TS template,
      // which reaches the AST as literal text in a single quasi.
      name: "the devbox clone line",
      code: 'const s = `git clone "https://x-access-token:\\${GITHUB_PAT}@github.com/o/r.git" /root/dev/r`;',
      errors: [{ messageId: "credentialInUrl" }],
    },
    {
      // The EXACT line from build-devbox-repo-setup.ts: the secret is a
      // shell-level ${VAR} and the HOST is a TS interpolation, so no quasi
      // contains a complete `user:secret@host`. The first version of this rule
      // missed this and would have shipped guarding everything except the
      // thing it was written for.
      name: "credential whose host is the interpolation",
      code: 'const s = `git clone "https://x-access-token:\\${GITHUB_PAT}@${repoUrlSuffix}" ${repoDir}`;',
      errors: [{ messageId: "credentialInUrl" }],
    },
    {
      name: "a literal credential",
      code: 'const u = "https://admin:Tr0ub4dor3@db.prod.internal";',
      errors: [{ messageId: "credentialInUrl" }],
    },
    {
      // The JS-level form: the credential straddles an interpolation, so no
      // single quasi contains it.
      name: "a credential split across an interpolation",
      code: "const u = `https://x-access-token:${token}@github.com/o/r.git`;",
      errors: [{ messageId: "credentialInUrl" }],
    },
    {
      name: "a non-https scheme is still a credential",
      code: 'const u = "ftp://deploy:s3cr3t@files.corp.io/drop";',
      errors: [{ messageId: "credentialInUrl" }],
    },
  ],
});
