import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

// The five rules that cannot work without configuration. Each names an
// identifier, scope or module that has no universal default, so the schema
// REQUIRES it — a rule that silently no-ops when misconfigured is
// indistinguishable from one you never installed, and that is the failure mode
// these assertions exist to prevent.
const REQUIRED = {
  "workspace-runtime-imports": [{ scopes: ["@acme/"] }],
  "quality-model-token-floor": [{ tierFunction: "getQualityModel", floorIdentifier: "TOKEN_FLOOR" }],
  "markdown-map-code-styles": [{ markerImport: "FONT_STYLES", builder: "buildCodeStyles" }],
  "rpc-error-standard": [{ errorModule: "/src/lib/errors/" }],
};

const linter = new Linter();

// No `files` key: a config that carries one only applies to a matching
// filename, and an unmatched config validates nothing — which would make every
// assertion below pass vacuously.
function lint(ruleName, options) {
  return linter.verify("export const a = 1;", {
    languageOptions: { parser: tsParser },
    plugins: { probe: plugin },
    rules: { [`probe/${ruleName}`]: ["error", ...options] },
  });
}

describe("required options", () => {
  it.each(Object.entries(REQUIRED))("%s is rejected when its options are omitted", (name) => {
    expect(() => lint(name, [])).toThrow();
  });

  it.each(Object.entries(REQUIRED))("%s is accepted when configured", (name, options) => {
    expect(() => lint(name, options)).not.toThrow();
  });

  it("rejects an unknown option key", () => {
    expect(() => lint("workspace-runtime-imports", [{ scopes: ["@acme/"], nope: true }])).toThrow();
  });

  // tamagui-native-id's `forwarders` is genuinely optional — an empty map is a
  // coherent default (nothing forwards), unlike the five above.
  it("tamagui-native-id works with no options", () => {
    expect(() => lint("tamagui-native-id", [])).not.toThrow();
  });
});
