#!/usr/bin/env node
// Scans every social-mode string in src/lib/kilo/copy.ts for stake.us restricted
// terms (whole word, case-insensitive) and for a "$" currency prefix.
// With --sources it also lists restricted terms still hard-coded in string
// literals / JSX text under src/components/kilo and src/components/slot-controls.
import ts from "typescript";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;

// Stake Engine jurisdiction requirements, restricted → replacement list (social mode).
export const RESTRICTED = [
  "at the cost of", "be awarded to player's accounts", "bet", "bet/s", "betting", "bets",
  "bonus buy", "bought", "buy", "buy bonus", "cash", "cost of", "credit", "currency",
  "deposit", "fund", "gamble", "money", "paid", "paid out", "pay", "pay out", "payer",
  "pays", "pays out", "place your bets", "purchase", "rebet", "stake", "total bet",
  "wager", "withdraw", "win feature",
  // Explicitly called out: "Pay table" / "Paytable" are not allowed.
  "pay table", "paytable",
];
// Not on the list, but inflections reviewers are likely to read the same way.
export const ADVISORY = ["buys", "buying", "purchases", "purchased", "paying", "cashed", "wagers", "stakes"];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/ /g, "\\s+");
const re = (words) => new RegExp(`(?<![A-Za-z0-9])(${words.map(esc).join("|")})(?![A-Za-z0-9])`, "gi");
const HARD = re(RESTRICTED);
const SOFT = re(ADVISORY);

async function loadCopy() {
  const dir = mkdtempSync(join(tmpdir(), "kilo-copy-"));
  const out = join(dir, "copy.mjs");
  const source = readFileSync(join(root, "src/lib/kilo/copy.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  writeFileSync(out, outputText);
  return import(pathToFileURL(out).href);
}

const render = (v) => (typeof v === "function" ? v(...Array.from({ length: v.length }, (_, i) => `{arg${i}}`)) : String(v));

const { COPY } = await loadCopy();
let failures = 0, advisories = 0;
const keys = Object.keys(COPY);
for (const key of keys) {
  const social = render(COPY[key].social);
  const hits = [...social.matchAll(HARD)].map((m) => m[0]);
  if (hits.length) { failures++; console.log(`FAIL ${key}: ${hits.join(", ")}  «${social}»`); }
  if (/\$\s*\{?arg|\$\d/.test(social)) { failures++; console.log(`FAIL ${key}: "$" currency prefix «${social}»`); }
  const soft = [...social.matchAll(SOFT)].map((m) => m[0]);
  if (soft.length) { advisories++; console.log(`WARN ${key}: ${soft.join(", ")}  «${social}»`); }
}
const standardWithTerms = keys.filter((k) => render(COPY[k].standard).match(HARD)).length;
console.log(`\n${keys.length} copy entries; ${standardWithTerms} standard values contain a restricted term; social: ${failures} failure(s), ${advisories} advisory warning(s).`);

if (process.argv.includes("--sources")) {
  const dirs = ["src/components/kilo", "src/components/slot-controls"];
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?)$/.test(f)) files.push(p); } };
  dirs.forEach((d) => walk(join(root, d)));
  // String literals and JSX text runs. Heuristic: code identifiers inside
  // quotes ("buy" mode ids, CSS classes, asset paths) are filtered below.
  const literal = /(["'`])((?:\\.|(?!\1)[^\\\n])*)\1|>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g;
  console.log("\nRemaining hard-coded restricted terms in string literals / JSX text:");
  let remaining = 0;
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*|import )/.test(line)) return;
      for (const m of line.matchAll(literal)) {
        const text = (m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
        if (!/\s/.test(text.trim())) continue; // single tokens: ids, classes, paths
        if (/^[\w-]+(\s[\w-]+)*$/.test(text) && /kk-|kf-|sc-|ks-/.test(text)) continue; // class lists
        const hits = [...text.matchAll(HARD)].map((h) => h[0]);
        if (hits.length) { remaining++; console.log(`${relative(root, file)}:${i + 1}: [${hits.join(", ")}] ${text.trim().slice(0, 120)}`); }
      }
      // Multi-line JSX text: a line that is only prose.
      if (/^\s*[A-Za-z][A-Za-z ,.'’;:×0-9·/-]*$/.test(line) && /\s\S+\s/.test(line.trim())) {
        const hits = [...line.matchAll(HARD)].map((h) => h[0]);
        if (hits.length) { remaining++; console.log(`${relative(root, file)}:${i + 1}: [${hits.join(", ")}] ${line.trim().slice(0, 120)}`); }
      }
    });
  }
  console.log(`${remaining} remaining line hit(s).`);
}
process.exit(failures ? 1 : 0);
