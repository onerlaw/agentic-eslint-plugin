import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

// A rule whose `meta.docs.url` points at a page that does not exist is worse
// than one with no url at all: it looks documented. Every url in this package
// resolved into a private repo before it was ported, so this is the check that
// keeps that from silently happening again.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_BASE = "https://github.com/onerlaw/agentic-eslint-plugin/blob/main/docs/rules/";

const entries = Object.entries(plugin.rules);

describe("docs parity", () => {
  it("exports at least one rule", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s has a docs page its meta.docs.url points at", (name, rule) => {
    const url = rule.meta?.docs?.url;
    expect(url, `${name} has no meta.docs.url`).toBe(`${DOCS_BASE}${name}.md`);
    const page = path.join(ROOT, "docs", "rules", `${name}.md`);
    expect(fs.existsSync(page), `${page} does not exist`).toBe(true);
  });

  it.each(entries)("%s declares a description and a schema", (name, rule) => {
    expect(typeof rule.meta?.docs?.description, `${name} description`).toBe("string");
    // Either form is legal: an array of per-option schemas, or a full array
    // schema (which the required-option rules use so that omitting options
    // entirely is an error — see tests/required-options.test.js).
    const schema = rule.meta?.schema;
    expect(Array.isArray(schema) || typeof schema === "object", `${name} schema`).toBe(true);
  });

  it("has no docs page without a matching rule", () => {
    const pages = fs
      .readdirSync(path.join(ROOT, "docs", "rules"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
    expect(pages).toEqual(entries.map(([name]) => name).sort());
  });
});
