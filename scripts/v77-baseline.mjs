/** Portable immutable v66 comparison source. No Git installation is required. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'art/kilo-v77/baseline/v66');
const manifestPath = path.join(root, 'art/kilo-v77/v66-baseline.json');
export const BASELINE_COMMIT = '147b96ea754a838dc878f503ec5db3593f607852';
export const BASELINE_MANIFEST_SHA256 = '1cf8ed8740cde91e92df8b231265beac63b45943537178651386a1a6e3e1deb8';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = fs.readFileSync(manifestPath);
if (sha256(manifestBytes) !== BASELINE_MANIFEST_SHA256) {
  throw new Error('The portable v66 baseline manifest has changed');
}
const parsed = JSON.parse(manifestBytes);
if (parsed.commit !== BASELINE_COMMIT) throw new Error('Unexpected v66 baseline commit');
export const baselineManifest = Object.freeze({ ...parsed, files: Object.freeze(parsed.files) });

function canonical(relativePath) {
  if (typeof relativePath !== 'string') throw new TypeError('Baseline path must be relative text');
  const normalized = relativePath.replaceAll('\\', '/');
  if (path.posix.isAbsolute(normalized) || /^[a-z]:/i.test(normalized) ||
      normalized.split('/').some(part => part === '..') || path.posix.normalize(normalized) !== normalized) {
    throw new Error(`Invalid relative baseline path: ${relativePath}`);
  }
  if (!Object.hasOwn(baselineManifest.files, normalized)) throw new Error(`Not a recorded v66 file: ${relativePath}`);
  return normalized;
}

function selected(relativePath) {
  return relativePath.startsWith('src/') ||
    (relativePath.startsWith('public/') && relativePath.endsWith('.json'));
}

/** Read source/JSON bytes whose hash was frozen from the exact v66 Git blob. */
export function readBaseline(relativePath) {
  const relative = canonical(relativePath);
  if (!selected(relative)) throw new Error(`Baseline bundle contains only source and JSON: ${relative}`);
  const bytes = fs.readFileSync(path.join(directory, relative));
  if (sha256(bytes) !== baselineManifest.files[relative]) {
    throw new Error(`Portable v66 baseline bytes have changed: ${relative}`);
  }
  return bytes.toString('utf8');
}

/** Existing source/art changes only; newly created assets are intentionally separate. */
export function changedExistingFiles() {
  return Object.keys(baselineManifest.files).sort().filter(relative => {
    const current = path.join(root, relative);
    return !fs.existsSync(current) || sha256(fs.readFileSync(current)) !== baselineManifest.files[relative];
  });
}

/** Verify the complete portable text bundle, including files not imported in one test. */
export function verifyBaselineBundle() {
  const files = Object.keys(baselineManifest.files).filter(selected).sort();
  let bytes = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(directory, file));
    if (sha256(raw) !== baselineManifest.files[file]) throw new Error(`Portable v66 baseline bytes have changed: ${file}`);
    bytes += raw.length;
  }
  return { commit: BASELINE_COMMIT, files: files.length, bytes, manifestSHA256: BASELINE_MANIFEST_SHA256 };
}
