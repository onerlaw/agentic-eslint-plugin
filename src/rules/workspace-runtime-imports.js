import fs from "node:fs";
import path from "node:path";

const PACKAGE_NAME_SEGMENTS = 2;

const ADVICE =
  "It resolves under Node but NOT in a bundler build that never built the workspace " +
  "package's dist/. Use `import type` if you only need types.";

/** Does `specifier` belong to any of the configured workspace scopes? */
function inScope(specifier, scopes) {
  return scopes.some((scope) => specifier.startsWith(scope));
}

/**
 * Test files are exempt in THREE forms, not two — the replaced script's
 * `isTestFile` was `/\.(test|spec)\.tsx?$/ || filePath.includes("/__tests__/")`.
 * An exemption written from the suffix forms alone silently un-exempts a
 * non-suffixed file under `__tests__/`.
 */
function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return /\.(test|spec)\.tsx?$/.test(normalized) || normalized.includes("/__tests__/");
}

/** Nearest package.json walking up from the linted file. */
function nearestPackageJson(fromFile) {
  let dir = path.dirname(fromFile);
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function declaredWorkspaceDeps(packageJsonPath, scopes) {
  // A malformed manifest must not take down the whole `eslint .` run with a
  // stack trace — every other guard here degrades to a diagnostic. Returning an
  // empty set is the safe direction: it flags MORE, matching the rule's stated
  // bias toward false positives.
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch {
    return new Set();
  }
  return new Set(
    [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].filter(
      (name) => inScope(name, scopes),
    ),
  );
}

/** "@scope/pkg/sub" resolves through the same package entry as "@scope/pkg". */
function basePackageName(specifier) {
  return specifier.split("/").slice(0, PACKAGE_NAME_SEGMENTS).join("/");
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ban runtime imports of workspace packages the nearest package.json does not declare.",
      // WHY: a monorepo web bundle is often produced by a job that runs only on
      // merge — `npm ci` plus a bundler export, with NO `turbo build`/`tsc -b`
      // first, so no workspace package's `dist/` exists on that runner. A runtime
      // import of an undeclared workspace package therefore resolves fine under
      // Node (local dev, CI lint/typecheck/tests, all of which pre-build the
      // dist) and fails ONLY in the production build. That asymmetry is the whole
      // hazard: every gate you have says green.
      //
      // NOT delegable to `import/no-extraneous-dependencies`: that rule treats
      // workspace packages as exempt, which is precisely and only the category
      // this guard covers. Adopting it would report success on the real failure.
      //
      // POLARITY: default-deny on value edges. `import type` / `export type` are
      // erased by the TS transform and create no module edge, so they stay legal.
      //
      // KNOWN BLIND SPOTS:
      //  1. A statement-level value import whose specifiers are ALL inline-`type`
      //     (`import { type A } from "@scope/pkg"`) is still flagged, because
      //     whether the transform elides such a statement depends on compiler
      //     options. Treating it as an edge is the safe side.
      //  2. A dynamic `import()` with a STATIC string is covered. Only a COMPUTED
      //     specifier (`import(someVar)`) is invisible — there is no static
      //     string to resolve.
      //  3. A malformed `package.json` degrades to "nothing is declared", which
      //     flags MORE rather than less. Deliberate: a guard must not take down
      //     the lint run with a stack trace, and over-reporting is the safe
      //     direction.
      url: "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/workspace-runtime-imports.md",
    },
    // The schema is a FULL array schema, not the usual array-of-item-schemas.
    // That is deliberate and load-bearing: ESLint validates only the options a
    // config actually PROVIDES, so a `required` inside items[0] never fires
    // when the rule is enabled with no options at all — the single likeliest
    // misconfiguration. `minItems: 1` is what makes omission an error instead
    // of a silent no-op.
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: [
        {
          type: "object",
          properties: {
            scopes: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
          },
          required: ["scopes"],
          additionalProperties: false,
        },
      ],
    },
    messages: {
      undeclared: "runtime import of {{pkg}}, which {{manifest}} does not declare. " + ADVICE,
    },
  },

  create(context) {
    const scopes = context.options[0]?.scopes ?? [];
    const filename = context.filename ?? context.getFilename();
    if (isTestFile(filename)) return {};

    const packageJsonPath = nearestPackageJson(filename);
    if (!packageJsonPath) return {};
    const declared = declaredWorkspaceDeps(packageJsonPath, scopes);
    const manifest = path.relative(context.cwd, packageJsonPath).replace(/\\/g, "/");

    function check(node, specifierNode, isTypeEdge) {
      if (isTypeEdge) return;
      const value = specifierNode?.value;
      if (typeof value !== "string" || !inScope(value, scopes)) return;
      const pkg = basePackageName(value);
      if (declared.has(pkg)) return;
      context.report({ node, messageId: "undeclared", data: { pkg, manifest } });
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source, node.importKind === "type");
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source, node.exportKind === "type");
      },
      ExportAllDeclaration(node) {
        check(node, node.source, node.exportKind === "type");
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "require") return;
        check(node, node.arguments[0], false);
      },
      // A dynamic `import("@scope/pkg")` with a static specifier is a runtime
      // edge exactly like a static import — it is what the bundler must resolve.
      // Omitting this visitor narrows the guard silently.
      ImportExpression(node) {
        check(node, node.source, false);
      },
    };
  },
};
