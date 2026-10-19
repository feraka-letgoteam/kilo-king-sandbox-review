#!/usr/bin/env node
/** Source/package and behavioral audio checks; this is not a browser listening test. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public/kilo-audio');
const source = readFileSync(resolve(root, 'src/lib/kilo/sound.ts'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest-v54.json')));
const sprites = JSON.parse(readFileSync(resolve(publicDir, 'sfx.json')));
const assetNames = [...source.matchAll(/"\/kilo-audio\/([^"\s]+)"/g)].map(match => match[1]);
assert.equal(assetNames.length, 8, 'All eight current resource references must be checked');
assert.equal(new Set(assetNames).size, 8);
assert.equal(manifest.channels, 2);
assert.equal(manifest.sampleRate, 44100);
assert.equal(manifest.original, true);
assert.equal(manifest.cueCount, Object.keys(sprites).length);

const checks = [];
for (const name of assetNames) {
  const path = resolve(publicDir, name);
  assert(existsSync(path), `Missing public sound resource: ${name}`);
  assert(readFileSync(path).length > 0, `Empty sound resource: ${name}`);
  if (process.argv.includes('--dist')) {
    const built = resolve(root, 'dist/kilo-audio', name);
    assert(existsSync(built), `Missing built sound resource: ${name}; build the site first`);
    assert.deepEqual(readFileSync(built), readFileSync(path), `Stale built sound resource: ${name}`);
  }
}

let spriteDuration = 0;
for (const entry of manifest.files) {
  const path = resolve(publicDir, entry.file);
  const binary = readFileSync(path);
  assert.equal(createHash('sha256').update(binary).digest('hex'), entry.sha256, `${entry.file} checksum`);
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8' }));
  assert.equal(info.streams.length, 1, `${entry.file}: audio only`);
  assert.equal(info.streams[0].codec_name, 'vorbis');
  assert.equal(Number(info.streams[0].sample_rate), manifest.sampleRate);
  assert.equal(info.streams[0].channels, 2);
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], { maxBuffer: 64 * 1024 * 1024 });
  let peak = 0;
  let sumSquares = 0;
  for (let offset = 0; offset < pcm.length; offset += 4) {
    const sample = pcm.readFloatLE(offset);
    assert(Number.isFinite(sample), `${entry.file}: non-finite sample`);
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
  }
  const duration = pcm.length / (4 * manifest.channels * manifest.sampleRate);
  const rms = Math.sqrt(sumSquares / (pcm.length / 4));
  assert(peak < .99, `${entry.file}: clipped or insufficient encoded headroom (${peak})`);
  assert(rms > .01 && rms < .3, `${entry.file}: unexpectedly silent or overdriven (${rms})`);
  assert(Math.abs(duration - entry.seconds) < .003, `${entry.file}: changed duration`);
  if (entry.file === 'sfx.ogg') spriteDuration = duration;
  if (['bed-base.ogg', 'bed-spin.ogg', 'bed-feature.ogg', 'bed-chopper.ogg'].includes(entry.file)) {
    assert(Math.abs(duration - manifest.barsPerBed * 4 * 60 / manifest.bpm) < .003, `${entry.file}: beds are not bar-aligned`);
    const samplesPerChannel = pcm.length / 8;
    for (let channel = 0; channel < 2; channel++) {
      const start = pcm.readFloatLE(channel * 4);
      const end = pcm.readFloatLE((samplesPerChannel - 1) * 8 + channel * 4);
      assert(Math.abs(start - end) < .07, `${entry.file}: likely loop-boundary click`);
    }
  }
  checks.push({ file: entry.file, seconds: Number(duration.toFixed(3)), peak: Number(peak.toFixed(4)), rms: Number(rms.toFixed(4)) });
}

let previousEnd = 0;
for (const [name, value] of Object.entries(sprites)) {
  assert.equal(value.length, 2, `${name}: sprite tuple`);
  assert(value.every(Number.isFinite));
  assert(value[0] >= previousEnd, `${name}: overlaps a prior sprite`);
  assert(value[1] > 0 && value[1] <= 2000, `${name}: one-shots must be finite and short`);
  assert(value[0] + value[1] <= spriteDuration * 1000 + 1, `${name}: range exceeds buffer`);
  previousEnd = value[0] + value[1];
}
const literalNames = [...source.matchAll(/\bplay\("([A-Za-z0-9]+)"/g)].map(match => match[1]);
for (const name of [...literalNames, 'land1', 'land2', 'land3', 'land4', 'land5', 'scatter1', 'scatter2', 'scatter3']) {
  assert(sprites[name], `Source calls absent cue: ${name}`);
}
assert(!source.includes('matchMedia'), 'Motion preference must not change audio availability');

// Execute the actual transpiled module against a small AudioContext/fetch double.
// These checks catch loading/cache mistakes without pretending to test the browser mix.
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch, error: console.error };
const starts = [];
const storage = new Map();
let fetchCount = 0;
let mapAttempts = 0;
let failFirstMap = true;
let malformedMap = false;
class Param {
  value = 1;
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param();
  playbackRate = new Param();
  connect() {}
  disconnect() {}
  stop() { this.onended?.(); }
  start(time, offset, duration) { starts.push({ asset: this.buffer?.asset, time, offset, duration, loop: this.loop }); }
}
class Context {
  currentTime = 1;
  state = 'suspended';
  destination = {};
  createGain() { return new Node(); }
  createBufferSource() { return new Node(); }
  async resume() { this.state = 'running'; }
  async decodeAudioData(buffer) {
    return { asset: buffer.asset, duration: buffer.asset.endsWith('/sfx.ogg') ? spriteDuration : manifest.barsPerBed * 4 * 60 / manifest.bpm };
  }
}
try {
  globalThis.window = { AudioContext: Context, setTimeout() { return 1; }, matchMedia() { throw new Error('Audio queried visual motion preferences'); } };
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  const expectedErrors = [];
  console.error = (...args) => expectedErrors.push(args);
  globalThis.fetch = async url => {
    fetchCount++;
    if (url.endsWith('.json')) {
      mapAttempts++;
      const ok = !(failFirstMap && mapAttempts === 1);
      return { ok, json: async () => malformedMap ? { ...sprites, cargoLock: [0, spriteDuration * 1000 + 100] } : sprites };
    }
    return { ok: true, arrayBuffer: async () => ({ asset: url }) };
  };
  const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  await Promise.all([mod.preloadAudio(), mod.preloadAudio()]);
  assert.equal(mapAttempts, 1, 'Concurrent loads should share one attempt');
  assert.equal(mod.audioReady(), false, 'Failed load must not report ready');
  await mod.preloadAudio();
  assert.equal(mapAttempts, 2, 'Next call retries a failed map fetch');
  assert.equal(mod.audioReady(), true, 'Complete pack becomes ready');
  const loadedFetches = fetchCount;
  await mod.preloadAudio();
  assert.equal(fetchCount, loadedFetches, 'Ready state does not reload the complete pack');
  for (const name of mod.FEATURE_CUE_NAMES) assert(sprites[name], `Missing named feature cue: ${name}`);
  mod.bonusEnter('base', 'route');
  assert.equal(starts.at(-1).asset, '/kilo-audio/bed-chopper.ogg', 'Natural five-scatter uses route music, independent of charge mode');
  mod.bonusEnter('chopper');
  mod.bonusEnter('yacht');
  assert.equal(starts.at(-1).asset, '/kilo-audio/bed-feature.ogg');
  const before = starts.length;
  for (const name of mod.FEATURE_CUE_NAMES) mod.featureCue(name);
  assert.equal(starts.length - before, mod.FEATURE_CUE_NAMES.length, 'Every feature cue plays with reduced motion independent of audio');
  for (const [index, name] of mod.FEATURE_CUE_NAMES.entries()) {
    assert.equal(starts[before + index].offset, sprites[name][0] / 1000, `${name} sprite offset`);
    assert.equal(starts[before + index].duration, sprites[name][1] / 1000, `${name} sprite duration`);
  }
  mod.setMuted(true);
  const mutedCount = starts.length;
  mod.featureCue('cargoLock');
  assert.equal(starts.length, mutedCount, 'Explicit mute prevents cue playback');
  mod.setMuted(false);
  mod.setAudioVolumes(101, -1);
  assert.deepEqual(mod.audioVolumes(), { music: 100, effects: 0 });
  assert.equal(expectedErrors.length, 1, 'Only the intended missing-resource error occurred');
  // Corrupt metadata cannot mark the pack ready, and repairing it permits retry.
  failFirstMap = false;
  malformedMap = true;
  const malformed = await import(`data:text/javascript;base64,${Buffer.from(compiled + '\n// fresh malformed-map test').toString('base64')}`);
  await malformed.preloadAudio();
  assert.equal(malformed.audioReady(), false);
  malformedMap = false;
  await malformed.preloadAudio();
  assert.equal(malformed.audioReady(), true);
} finally {
  globalThis.window = previous.window;
  globalThis.localStorage = previous.localStorage;
  globalThis.fetch = previous.fetch;
  console.error = previous.error;
}
console.log(JSON.stringify({ status: 'passed', resources: assetNames.length, cues: Object.keys(sprites).length,
  sourceComplete: true, distComplete: process.argv.includes('--dist') ? true : 'not requested',
  failedLoadRetry: true, malformedMapRetry: true, naturalRouteBed: true, reducedMotionIndependent: true,
  decodedFiles: checks, limitation: 'Numeric/source verification only; no browser playback or listening certification.' }, null, 2));
