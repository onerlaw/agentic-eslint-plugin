# @onerlaw/agentic-eslint-plugin

ESLint guard rules that mechanize conventions agents keep breaking.

Every rule here exists because a specific defect shipped — usually more than once, and
usually in code that a type-checker, a formatter, and a full test suite all called clean.
That is the selection criterion: a rule earns its place when the failure is **invisible
to every gate you already have**, recurs because each fix only sees its own call site,
and is cheap to detect statically.

They were written for one codebase and generalized. Several are broadly useful; some are
shaped for a particular stack, and the table below says which is which rather than
implying they all apply to you.

## Install

```sh
npm install --save-dev @onerlaw/agentic-eslint-plugin
```

Requires ESLint 9+ (flat config) and Node 20+. Written in TypeScript, published as plain
ESM JavaScript with type declarations — you install compiled output and never build it.

## Usage

```js
// eslint.config.js
import agentic from "@onerlaw/agentic-eslint-plugin";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { agentic },
    rules: {
      "agentic/no-credential-in-url": "error",
      "agentic/one-export-per-file": "error",
    },
  },
];
```

### There is deliberately no `recommended` preset

These rules walk genuinely different file sets. Reusing one config block for all of them
silently unguards whatever that block ignores — which is the exact failure mode several
of them exist to catch. **Give each rule its own config block**, matching the files it
must actually cover. Every rule's docs page ends with a copy-pasteable recipe.

## Rules

| Rule | Guards against | Framework | Options |
|---|---|---|---|
| [`no-credential-in-url`](docs/rules/no-credential-in-url.md) | `scheme://user:secret@host` — git persists it into `.git/config` and every tool that prints the remote leaks it | none | — |
| [`no-biome-ignore`](docs/rules/no-biome-ignore.md) | inline `biome-ignore` comments, which hide a finding and explain nothing | none | — |
| [`one-export-per-file`](docs/rules/one-export-per-file.md) | more than one exported function per file, so the filename stops predicting the export | none | optional |
| [`workspace-runtime-imports`](docs/rules/workspace-runtime-imports.md) | runtime imports of undeclared workspace packages — resolve under Node, fail only in the production bundle | none | **required** |
| [`quality-model-token-floor`](docs/rules/quality-model-token-floor.md) | a reasoning-model token cap sized for output alone, silently eaten by thinking tokens | none | **required** |
| [`rpc-error-standard`](docs/rules/rpc-error-standard.md) | feature code hand-classifying RPC failures instead of routing through one error module | Connect-RPC shaped | **required** |
| [`markdown-map-code-styles`](docs/rules/markdown-map-code-styles.md) | markdown style maps inheriting library defaults per-property | react-native-markdown-display | **required** |
| [`tamagui-native-id`](docs/rules/tamagui-native-id.md) | `nativeID` on a non-react-native component, which renders no DOM `id` on web | react-native-web | optional |
| [`responsive-two-pane-flex`](docs/rules/responsive-two-pane-flex.md) | unconditional `flex: 1` in a column-to-row responsive screen, which collapses to height 0 | Tamagui | — |
| [`workspace-chrome-flex`](docs/rules/workspace-chrome-flex.md) | any unguarded flex factor in a shared two-pane layout's chrome | Tamagui | optional |

**Options: required** means the rule names an identifier, scope or module that has no
universal default. Enabling such a rule without options is a **config error**, not a
silent no-op — see [below](#a-rule-that-silently-does-nothing-is-worse-than-no-rule).

## Design notes

### A rule that silently does nothing is worse than no rule

A tool you declare but never wire is indistinguishable from one you never had — except
that it reads as coverage. The four rules that cannot work unconfigured use a **full
array schema** with `minItems: 1`, not the usual array-of-item-schemas, because ESLint
validates only the options a config actually *provides*: a `required` inside `items[0]`
never fires when the rule is enabled with no options at all, which is the single likeliest
misconfiguration. `tests/required-options.test.js` pins this.

### Each rule carries its own record

Every rule states, inline in `meta.docs`, why it exists, its **polarity and
false-positive bias**, and its **known blind spots**. The bias belongs where the next
reader will see it, which is the rule file — not only a linked page. Two polarities are
**pinned** and must not be "improved": `tamagui-native-id` stays default-deny, and
`responsive-two-pane-flex` keeps file-scoped detection. Relaxing a guard's polarity to
chase elegance is how it stops catching what it was built for.

### Bias toward false positives

Nearly every rule here errs loud. A false positive costs one deliberate look; a false
negative costs another shipped regression. The exception is `no-credential-in-url`, which
is biased hard the *other* way — a noisy secret rule gets suppressed, and a suppressed
rule provides no coverage at all while still reading as some.

### The build step earns its place, and `eslint .` still needs no build

This package used to point `main` at source and ship no compiled output, on the grounds
that "a plugin whose entry pointed at compiled output breaks any gate that runs
`eslint .` on a clean checkout without building first." That reasoning was right about
the *property* worth protecting and wrong that shipping source was the only way to get
it.

Sources are TypeScript now and `main`/`exports`/`types` point at `dist/`, so consumers
get type declarations they never had before. The clean-checkout property survives
intact, by a different route: `eslint.config.ts` imports `./src/index.ts` **directly**,
so `eslint .` runs against source and needs no prior build. What changed is who compiles
— the publisher, once, instead of nobody.

`prepare` is the hook that builds `dist/`, chosen over `prepublishOnly` because it also
fires on `npm install` in a fresh clone and on a git-URL install; `prepublishOnly` fires
on none of those. `npm run verify:pack` packs the real tarball, installs it into a
throwaway consumer, and checks that the package both runs and type-checks from the
installed artifact — with a negative control, so it cannot pass by resolving types to
`any`. It runs in CI on every PR and every release, because `files`, `exports`, `main`,
and `types` are all easy to break in an edit the unit tests would never notice.

### Rule authoring is type-checked, including JSX

`src/define-rule.ts` is the whole abstraction: it types each rule's options and message
ids, and derives its visitor from the full node union so JSX handlers are typed too.
That last part is the reason it exists rather than using ESLint's bundled `Rule.RuleModule`
directly — those types are vanilla ESTree with no JSX variants, so a `JSXAttribute(node)`
handler written against them silently degrades to `any`, on exactly the rules where AST
shape matters most. It adds **no runtime dependency**: the node types come from a
type-only import that the compiler erases.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/); releases are cut
automatically by semantic-release on merge to `main`, authenticated with npm trusted
publishing (OIDC) rather than a stored token.

## License

[MIT](LICENSE) © Derek Honerlaw
