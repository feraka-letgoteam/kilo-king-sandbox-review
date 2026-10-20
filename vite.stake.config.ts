import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

// Static Stake build: plain files, no server, relative paths so it runs from any
// CDN subfolder. Only the public/ files listed in stake/assets.txt are shipped
// (public/ itself is never touched). Build config only; no game code changes.
//
// Build flags (read nowhere yet; Builder 5's RGS wiring will consume them):
//   VITE_KK_WALLET  "rgs" by default for this target; VITE_KK_WALLET=sandbox to
//                   build the same target against the local sandbox wallet.
//   VITE_RGS_HOSTS  comma-separated RGS host allow-list, "*.suffix" allowed.
//                   Defaults to Stake's RGS hosts + *.live.engine.io + *.live.stake-engine.com; anything else fails closed.
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "dist-stake");
const LIST = path.join(ROOT, "stake/assets.txt");
const WALLET = process.env.VITE_KK_WALLET ?? "rgs";
const RGS_HOSTS = process.env.VITE_RGS_HOSTS ?? "rgs.stake-engine.com,rgs-us.stake-engine.com,*.live.engine.io,*.live.stake-engine.com";
if (!["rgs", "sandbox"].includes(WALLET)) throw new Error(`[stake] VITE_KK_WALLET must be rgs or sandbox, got "${WALLET}"`);

const keepList = () =>
  fs.readFileSync(LIST, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const tops = () =>
  [...new Set(keepList().map((f) => f.split("/")[0]))].sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Copies the explicit keep-list, rewrites root-absolute public paths to relative
 *  ones, then fails the build if any public path in the output is not shipped. */
function stakeAssets(): Plugin {
  let names: string[] = [];
  let absRef: RegExp;
  const rewritten = { html: 0, js: 0, css: 0 };
  const count = (code: string) => (code.match(absRef) ?? []).length;
  return {
    name: "kk-stake-assets",
    apply: "build",
    buildStart() {
      const files = keepList();
      const missing = files.filter((f) => !fs.existsSync(path.join(PUBLIC, f)));
      if (missing.length) this.error(`[stake] ${missing.length} listed asset(s) missing from public/:\n  ${missing.join("\n  ")}`);
      names = tops();
      // "/kilo-v79/x.webp" preceded by a quote, backtick or "(" (url()).
      absRef = new RegExp(`(["'\`(])\\/((?:${names.map(esc).join("|")})(?![\\w-]))`, "g");
    },
    transformIndexHtml(html) {
      rewritten.html += count(html);
      return html.replace(absRef, "$1./$2");
    },
    generateBundle(_, bundle) {
      for (const item of Object.values(bundle)) {
        // JS resolves against the page (index.html); CSS against assets/.
        if (item.type === "chunk") {
          rewritten.js += count(item.code);
          item.code = item.code.replace(absRef, "$1./$2");
        } else if (item.fileName.endsWith(".css") && typeof item.source === "string") {
          rewritten.css += count(item.source);
          item.source = item.source.replace(absRef, "$1../$2");
        }
      }
    },
    closeBundle() {
      const files = keepList();
      for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
        fs.copyFileSync(path.join(PUBLIC, f), path.join(OUT, f));
      }
      const shipped = new Set(files);
      const problems: string[] = [];
      const ref = new RegExp(`(["'\`(])(\\.{0,2}\\/)?((?:${names.map(esc).join("|")})(?:\\/[^"'\`)\\s,;?#]*)?)`, "g");
      const walk = (d: string): string[] =>
        fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
      for (const file of walk(OUT).filter((f) => /\.(js|css|html)$/.test(f))) {
        const text = fs.readFileSync(file, "utf8");
        const rel = path.relative(OUT, file);
        for (const m of text.matchAll(ref)) {
          const [, , prefix, p] = m;
          if (prefix === "/") { problems.push(`${rel}: root-absolute "/${p}" (breaks under a CDN subfolder)`); continue; }
          if (!p.includes("/")) continue;
          const dyn = p.indexOf("${");
          if (dyn >= 0 || p.endsWith("/")) {
            const dir = (dyn >= 0 ? p.slice(0, dyn) : p).replace(/\/[^/]*$/, "");
            if (![...shipped].some((s) => s.startsWith(dir + "/"))) problems.push(`${rel}: dynamic folder "${dir}/" has no shipped files`);
            continue;
          }
          if (/\.[a-z0-9]{2,5}$/i.test(p) && !shipped.has(p)) problems.push(`${rel}: "${p}" is not in the output`);
        }
      }
      // F6: static files only. index.html must not load anything external; other
      // http(s) strings in the bundle are listed so they can be reviewed.
      const external = new Map<string, Set<string>>();
      for (const file of walk(OUT).filter((f) => /\.(js|css|html)$/.test(f))) {
        const rel = path.relative(OUT, file);
        for (const m of fs.readFileSync(file, "utf8").matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
          if (!external.has(m[0])) external.set(m[0], new Set());
          external.get(m[0])!.add(rel);
        }
      }
      for (const [url, where] of external) if (where.has("index.html")) problems.push(`index.html: external URL ${url}`);
      if (external.size) console.log(`[stake] http(s) strings in output (review; none may be fetched at runtime):\n  ${[...external].map(([u, w]) => `${u}  <- ${[...w].join(", ")}`).join("\n  ")}`);
      if (problems.length) {
        throw new Error(`[stake] ${problems.length} unresolved asset reference(s):\n  ${[...new Set(problems)].join("\n  ")}`);
      }
      const bytes = files.reduce((s, f) => s + fs.statSync(path.join(PUBLIC, f)).size, 0);
      console.log(`[stake] copied ${files.length} public files (${(bytes / 1048576).toFixed(1)} MB); asset reference check OK; rewrote root-absolute paths html=${rewritten.html} js=${rewritten.js} css=${rewritten.css}; wallet=${WALLET}`);
    },
  };
}

export default defineConfig({
  root: path.join(ROOT, "stake"),
  base: "./",
  publicDir: false,
  envDir: false,
  plugins: [react(), tailwindcss(), stakeAssets()],
  resolve: { alias: { "@": path.join(ROOT, "src") } },
  define: {
    "import.meta.env.VITE_KK_WALLET": JSON.stringify(WALLET),
    "import.meta.env.VITE_RGS_HOSTS": JSON.stringify(RGS_HOSTS),
  },
  build: { outDir: OUT, emptyOutDir: true, rolldownOptions: { input: path.join(ROOT, "stake/index.html") } },
});
