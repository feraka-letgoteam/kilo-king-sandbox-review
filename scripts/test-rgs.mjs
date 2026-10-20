#!/usr/bin/env node
// Runs src/lib/rgs tests on Node 20: transpiles the TS with the repo's typescript, then node --test.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src/lib/rgs");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "rgs-test-"));
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}');
for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".ts"))) {
  const code = ts.transpileModule(fs.readFileSync(path.join(src, f), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText.replace(/(from\s+["']\.\/[^"']+)\.ts(["'])/g, "$1.js$2");
  fs.writeFileSync(path.join(out, f.replace(/\.ts$/, ".js")), code);
}
const r = spawnSync(process.execPath, ["--test", path.join(out, "rgs.test.js")], {
  stdio: "inherit",
  env: { ...process.env, MOCK_RGS_PATH: path.join(root, "scripts/mock-rgs.mjs") },
});
fs.rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
