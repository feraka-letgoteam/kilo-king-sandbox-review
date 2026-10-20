#!/usr/bin/env node
// Streams every phase2 book through the RGS book adapter, one mode at a time (never loads a whole file).
// Usage: node scripts/verify-books.mjs [booksDir] [mode ...]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2] || "/workspace/kilo-math/phase2/out/books";
const only = process.argv.slice(3);
const PY = process.env.KILO_ZSTD_PYTHON || "/workspace/kilo-math/phase2/.venv/bin/python";
const src = path.join(root, "src/lib/rgs");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "rgs-verify-"));
fs.writeFileSync(path.join(out, "package.json"), '{"type":"module"}');
for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
  const code = ts.transpileModule(fs.readFileSync(path.join(src, f), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/(from\s+["']\.\/[^"']+)\.ts(["'])/g, "$1.js$2");
  fs.writeFileSync(path.join(out, f.replace(/\.ts$/, ".js")), code);
}
const { roundStateToScript, winMatchesServer, scriptUnitsToMicro } = await import(pathToFileURL(path.join(out, "book-adapter.js")).href);
const { formatAmount } = await import(pathToFileURL(path.join(out, "currency.js")).href);

const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
const BET = 1_000_000; // $1 base bet in micro-units
const PYCODE = "import sys,zstandard as z\nr=z.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'))\nw=sys.stdout.buffer\nwhile True:\n  b=r.read(1<<20)\n  if not b: break\n  w.write(b)\n";
let allOk = true;
for (const m of index.modes) {
  if (only.length && !only.includes(m.name)) continue;
  const lut = new Map();
  for (const line of fs.readFileSync(path.join(dir, m.weights), "utf8").split("\n")) {
    const [id, w, pm] = line.split(",");
    if (id) lut.set(Number(id), Number(pm));
  }
  const t0 = Date.now();
  const p = spawn(PY, ["-c", PYCODE, path.join(dir, m.events)], { stdio: ["ignore", "pipe", "inherit"] });
  const rl = readline.createInterface({ input: p.stdout, crlfDelay: Infinity });
  const s = { books: 0, ok: 0, wins: 0, errors: {}, firstErr: null, lutMismatch: 0, maxPm: 0, idStart: Infinity, sample: null };
  for await (const line of rl) {
    if (!line) continue;
    s.books++;
    let b;
    try { b = JSON.parse(line); } catch { (s.errors["json"] = (s.errors["json"] || 0) + 1); continue; }
    s.idStart = Math.min(s.idStart, b.id);
    if (lut.get(b.id) !== b.payoutMultiplier) s.lutMismatch++;
    const pm = b.payoutMultiplier / 100;
    try {
      const r = roundStateToScript(b.events, BET, pm, m.name);
      if (!winMatchesServer(r.win, BET, pm)) throw Object.assign(new Error("win"), { reason: "win-mismatch" });
      s.ok++;
      if (pm > 0) s.wins++;
      if (pm > s.maxPm) { s.maxPm = pm; s.sample = { id: b.id, win: formatAmount(r.win, "USD"), mode: r.script.mode }; }
    } catch (e) {
      const k = e.reason || e.message;
      s.errors[k] = (s.errors[k] || 0) + 1;
      if (!s.firstErr) s.firstErr = { id: b.id, k, msg: String(e.message).slice(0, 200) };
    }
  }
  const code = await new Promise((r) => p.on("close", r));
  const good = code === 0 && s.ok === s.books && s.lutMismatch === 0 && lut.size === s.books;
  allOk &&= good;
  console.log(JSON.stringify({ mode: m.name, cost: m.cost, books: s.books, lutRows: lut.size, adapterOk: s.ok, wins: s.wins, idStart: s.idStart, lutMismatch: s.lutMismatch, errors: s.errors, firstErr: s.firstErr, maxWin: s.sample && { pm: s.maxPm, ...s.sample }, secs: Math.round((Date.now() - t0) / 1000), pyExit: code, result: good ? "OK" : "FAIL" }));
}
fs.rmSync(out, { recursive: true, force: true });
process.exit(allOk ? 0 : 1);
