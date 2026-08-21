// Verifies the PUBLISHED ARTIFACT, not the working tree: packs the real tarball,
// installs it into a throwaway consumer, and checks that a consumer can both RUN
// and TYPE-CHECK against it.
//
// This runs in CI on every PR and every release, not once during the TypeScript
// conversion. `files`, `exports`, `main`, and `types` are all easy to break in a
// later edit, and nothing else in the suite would notice: the unit tests import
// `src/`, so they pass whether or not the tarball is coherent.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_RULES = 10;

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-pack-"));
const consumer = path.join(tmp, "consumer");
fs.mkdirSync(consumer);
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

try {
  // 1. Pack the real tarball (this fires `prepare`, which builds dist/).
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", tmp], ROOT));
  const tarball = path.join(tmp, packed[0].filename);
  const entries = packed[0].files.map((f) => f.path);

  check("tarball contains dist/index.js", entries.includes("dist/index.js"));
  check("tarball contains dist/index.d.ts", entries.includes("dist/index.d.ts"));
  check(
    `tarball ships ${EXPECTED_RULES} compiled rules`,
    entries.filter((f) => f.startsWith("dist/rules/") && f.endsWith(".js")).length ===
      EXPECTED_RULES,
  );
  const stray = entries.filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  check("tarball ships no .ts source", stray.length === 0, stray.join(", "));

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const [label, rel] of [
    ["main", pkg.main],
    ["types", pkg.types],
    ["exports.types", pkg.exports["."].types],
    ["exports.default", pkg.exports["."].default],
  ]) {
    check(`${label} -> ${rel} is present in the tarball`, entries.includes(rel.replace("./", "")));
  }
  check("package.json declares no runtime dependencies", pkg.dependencies === undefined);

  // 2. Install the tarball into a throwaway consumer.
  fs.writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", version: "1.0.0", type: "module", private: true }, null, 2),
  );
  run("npm", ["install", tarball, "--no-audit", "--no-fund", "--legacy-peer-deps"], consumer);
  // eslint is a peerDependency, so a real consumer already has it. Link the one
  // from this repo rather than hitting the network.
  fs.symlinkSync(
    path.join(ROOT, "node_modules", "eslint"),
    path.join(consumer, "node_modules", "eslint"),
    "junction",
  );

  // 3. The installed package must RUN: expose every rule and actually report.
  fs.writeFileSync(
    path.join(consumer, "run.mjs"),
    `import { Linter } from "eslint";
import plugin from "@onerlaw/agentic-eslint-plugin";
const names = Object.keys(plugin.rules);
const messages = new Linter().verify('const u = "https://user:ghp_x@github.com/o/r.git";', {
  files: ["**/*.js"],
  plugins: { agentic: plugin },
  rules: { "agentic/no-credential-in-url": "error" },
}, "probe.js");
console.log(JSON.stringify({ count: names.length, reported: messages.map((m) => m.ruleId) }));
`,
  );
  const out = JSON.parse(run("node", ["run.mjs"], consumer).trim());
  check(`installed package exposes ${EXPECTED_RULES} rules`, out.count === EXPECTED_RULES, `got ${out.count}`);
  check("installed package reports on a real violation", out.reported.includes("agentic/no-credential-in-url"));

  // 4. The installed package must TYPE-CHECK for a TS consumer. The negative
  //    control is what stops this passing vacuously: if the types resolved to
  //    `any`, the bad file below would compile and we would call that success.
  fs.writeFileSync(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify(
      { compilerOptions: { module: "nodenext", moduleResolution: "nodenext", strict: true, noEmit: true, skipLibCheck: true }, include: ["*.ts"] },
      null, 2),
  );
  const tsc = path.join(ROOT, "node_modules", ".bin", "tsc");
  const typecheck = (source) => {
    fs.writeFileSync(path.join(consumer, "use.ts"), source);
    try {
      run(tsc, ["-p", "tsconfig.json"], consumer);
      return null;
    } catch (error) {
      return `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    }
  };

  const good = typecheck(
    `import plugin from "@onerlaw/agentic-eslint-plugin";\nconst name: string = plugin.meta.name;\nexport default name;\n`,
  );
  check("a TypeScript consumer type-checks against the shipped .d.ts", good === null, good ?? "");

  const bad = typecheck(
    `import plugin from "@onerlaw/agentic-eslint-plugin";\nconst name: number = plugin.meta.name;\nexport default name;\n`,
  );
  check(
    "NEGATIVE CONTROL: string -> number is rejected (types are real, not `any`)",
    bad !== null && bad.includes("TS2322"),
    bad === null ? "compiled clean — the .d.ts is not being resolved" : "",
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\nverify:pack FAILED (${failures} check${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("\nverify:pack passed");
