#!/usr/bin/env python3
"""Original Kilo King v54 sound design. No recordings, samples, or third-party music.

Rebuild: python scripts/build-kilo-audio-v54.py
Requires Python, numpy, scipy and ffmpeg/libvorbis. Seeded synthesis is deliberate:
soft electric keys, sub/wood percussion and mechanical Foley, not placeholder beeps.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/kilo-audio"
REPORT = ROOT / "art/kilo-features-v54/audio-report.md"
SR = 44100
BPM = 112
BEAT = 60 / BPM
BARS = 16
LOOP = BARS * 4 * BEAT
RNG = np.random.default_rng(540112)


def clock(seconds):
    return np.arange(round(seconds * SR), dtype=np.float64) / SR


def taper(signal, attack=.006, release=.025):
    result = np.asarray(signal, dtype=np.float64).copy()
    a, r = min(len(result), round(attack * SR)), min(len(result), round(release * SR))
    if a:
        result[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r:
        result[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return result


def filt(signal, hz, mode="lowpass", order=2):
    return sosfilt(butter(order, hz, fs=SR, btype=mode, output="sos"), signal)


def noise(seconds, lo=80, hi=2400):
    x = RNG.normal(0, 1, len(clock(seconds)))
    if lo:
        x = filt(x, lo, "highpass")
    if hi:
        x = filt(x, hi)
    return x / max(.001, np.std(x))


def freq(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def bass(midi, seconds, intensity=.7):
    t = clock(seconds)
    f = freq(midi)
    body = (np.sin(2*np.pi*f*t) + .22*np.sin(2*np.pi*2*f*t)
            + .075*np.sin(2*np.pi*3*f*t))
    env = (1 - np.exp(-t*190)) * np.exp(-t/1.1)
    return taper(np.tanh(body*intensity)*env, .008, .055)


def keys(midi, seconds=1.4):
    t = clock(seconds)
    f = freq(midi)
    # Damped tine with a small inharmonic attack and soft tape-like saturation.
    x = (np.sin(2*np.pi*f*t + .72*np.sin(2*np.pi*f*2*t)*np.exp(-t*6))
         + .15*np.sin(2*np.pi*f*3*t)*np.exp(-t*5)
         + .06*np.sin(2*np.pi*f*7.01*t)*np.exp(-t*18))
    return taper(filt(np.tanh(x*.8)*np.exp(-t*2.3), 2300), .009, .08)


def kick(seconds=.32):
    t = clock(seconds)
    phase = 2*np.pi*np.cumsum(46 + 58*np.exp(-t*48)) / SR
    body = np.sin(phase)*np.exp(-t*16)
    skin = noise(seconds, 120, 850)*np.exp(-t*85)*.14
    return taper(body + skin, .002, .025)


def rim(seconds=.16, pitch=185):
    t = clock(seconds)
    wood = (np.sin(2*np.pi*pitch*t)*np.exp(-t*38)
            + .38*np.sin(2*np.pi*pitch*2.7*t)*np.exp(-t*70))
    skin = noise(seconds, 450, 3300)*np.exp(-t*62)*.16
    return taper(wood + skin, .0015, .025)


def shaker(seconds=.11):
    t = clock(seconds)
    return taper(noise(seconds, 2000, 6500)*np.exp(-t*53), .004, .025)


def metal(seconds=.33, f=420):
    t = clock(seconds)
    x = sum(amp*np.sin(2*np.pi*f*ratio*t)*np.exp(-t*decay)
            for ratio, amp, decay in [(1, .55, 13), (2.32, .26, 24), (3.91, .1, 36)])
    return taper(filt(x + noise(seconds, 1200, 3600)*np.exp(-t*100)*.10, 4200), .002, .04)


def thud(seconds=.28, f=67):
    t = clock(seconds)
    return taper(np.sin(2*np.pi*f*t)*np.exp(-t*22)
                 + noise(seconds, 80, 850)*np.exp(-t*32)*.25, .003, .04)


def place(destination, mono, at, gain=1, pan=0, wrap=False):
    start = round(at*SR)
    gains = np.array([np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)])*gain
    stereo = mono[:, None]*gains
    if wrap:
        for shift in (-len(destination), 0, len(destination)):
            a, b = max(0, start+shift), min(len(destination), start+shift+len(mono))
            if b > a:
                destination[a:b] += stereo[a-start-shift:b-start-shift]
    else:
        a, b = max(0, start), min(len(destination), start+len(mono))
        if b > a:
            destination[a:b] += stereo[a-start:b-start]


def empty(seconds):
    return np.zeros((round(seconds*SR), 2), dtype=np.float64)


def finish(audio, peak=.67, fade=True):
    audio -= np.mean(audio, axis=0)
    if fade:
        audio = np.stack([taper(audio[:, i], .006, .055) for i in range(2)], axis=1)
    measured = np.max(np.abs(audio))
    return audio * (peak / max(measured, .001))


def music_bed(kind):
    track = empty(LOOP)
    # Same chord/bar grid across all beds, allowing phase-preserving crossfades.
    roots = [29, 29, 25, 25, 32, 32, 27, 27] * 2  # F, Db, Ab, Eb.
    chords = [[53, 56, 60, 67], [49, 53, 56, 63], [56, 60, 63, 70], [51, 55, 58, 65]]
    drive = {"base": .62, "spin": .84, "feature": 1., "chopper": 1.05}[kind]
    for bar, root in enumerate(roots):
        start = bar*4*BEAT
        chord = chords[(bar//2) % 4]
        for beat, length, velocity, interval in [
            (0, .72, .55, 0), (1.5, .42, .39, 0), (2.75, .58, .49, 7), (3.5, .30, .26, 12)
        ]:
            if kind == "base" and beat == 3.5:
                continue
            place(track, bass(root+interval, length*BEAT), start+beat*BEAT, velocity, wrap=True)
        for beat in [0, 2.5] + ([3.25] if kind in ("feature", "chopper") and bar % 2 else []):
            place(track, kick(), start+beat*BEAT, .46*drive, wrap=True)
        for beat in [1, 3]:
            place(track, rim(pitch=175+bar % 3*9), start+beat*BEAT, .18*drive, -.14, True)
        for eighth in range(8):
            if kind == "base" and eighth % 2 == 0:
                continue
            place(track, shaker(), start+(eighth*.5+.018*(eighth % 2))*BEAT,
                  (.046 if eighth % 2 else .023)*drive, .34 if eighth % 2 else -.34, True)
        # Offbeat warm keys; some bars breathe rather than fill every gap.
        for beat in ([.75] if kind == "base" else [.75, 2.25]):
            for i, note in enumerate(chord):
                place(track, keys(note, 1.5), start+beat*BEAT+i*.009,
                      .08 if kind == "base" else .105, -.28+i*.18, True)
        if kind in ("feature", "chopper"):
            for beat, note in [(1.75, chord[2]), (3.5, chord[1])]:
                place(track, keys(note+12, .48), start+beat*BEAT, .052, .22, True)
        if kind == "chopper":
            # Muted polyrhythmic rotor/percussion layer, not a continuous alarm.
            for beat in [.5, 1.25, 2.0, 2.75, 3.5]:
                place(track, rim(.10, 112), start+beat*BEAT, .068, -.24, True)
    return finish(track, {"base": .52, "spin": .55, "feature": .59, "chopper": .60}[kind], False)


def chord_cue(notes, seconds=.75, spacing=.055, low=41):
    track = empty(seconds)
    place(track, thud(.24, freq(low)), 0, .37)
    for i, note in enumerate(notes):
        place(track, keys(note, max(.2, seconds-i*spacing)), i*spacing, .29,
              -.25+i/max(1, len(notes)-1)*.5)
    return track


def cue_designs():
    cues = {}
    for n in range(1, 6):
        x = empty(.22)
        place(x, thud(.20, 64+n*3), 0, .63)
        place(x, rim(.12, 192+n*7), .014, .20, (n-3)*.12)
        cues[f"land{n}"] = x
    for n in range(1, 4):
        x = chord_cue([53, 56, 60][:n], .48 + .09*n, .04)
        place(x, metal(.26, 295), 0, .18)
        cues[f"scatter{n}"] = x
    x = empty(.14)
    place(x, rim(.12, 210), 0, .8)
    cues["ui"] = x
    x = empty(.12)
    place(x, metal(.10, 350), 0, .4)
    place(x, thud(.11, 94), 0, .5)
    cues["tick"] = x
    t = clock(.56)
    x = empty(.56)
    roll = noise(.56, 95, 1900)*(.34 + .16*np.sin(2*np.pi*31*t))
    place(x, taper(roll*np.exp(-t*3), .012, .09), 0, .34)
    place(x, thud(.23, 70), 0, .42)
    cues["spin"] = x
    cues["resolve"] = chord_cue([53, 60, 63, 68], .90, .055)
    cues["winSmall"] = chord_cue([60, 63], .52, .085)
    cues["winMid"] = chord_cue([56, 60, 63, 68], .92, .07)
    cues["winBig"] = chord_cue([53, 60, 63, 68, 72], 1.45, .095)
    x = empty(.44)
    place(x, thud(.30, 78), .10, .48)
    for at, f in [(0, 370), (.065, 445), (.12, 530)]:
        place(x, metal(.28, f), at, .25, -.2+at*3)
    cues["collect"] = x
    x = empty(.40)
    place(x, metal(.32, 310), 0, .65)
    place(x, rim(.16, 146), .08, .30)
    cues["tool"] = x
    cues["level"] = chord_cue([56, 60, 63, 68], .80, .09)
    cues["featureEnter"] = chord_cue([41, 53, 56, 60, 63], 1.20, .065, 29)
    cues["featureComplete"] = chord_cue([53, 56, 60, 65], 1.35, .09)
    # VS reel: a latching mechanism, line under tension, cargo seated in the hold.
    x = empty(.40)
    place(x, thud(.30, 58), 0, .65)
    place(x, metal(.25, 275), .025, .38, -.10)
    place(x, rim(.15, 144), .085, .22)
    cues["vsLatch"] = x
    t = clock(.66)
    x = empty(.66)
    pull = noise(.66, 150, 2100) * (.35+.65*np.sin(2*np.pi*(18*t+23*t*t))**8)
    place(x, taper(pull*np.sin(np.pi*np.minimum(1, t/.66))**.6, .025, .10), 0, .4)
    place(x, metal(.25, 240), .39, .33)
    cues["reelPull"] = x
    x = empty(.34)
    place(x, thud(.28, 62), 0, .68)
    place(x, metal(.22, 315), .045, .24)
    cues["cargoLock"] = x
    # Rotor approaches once and leaves. Filtered air and irregular low motor partials.
    t = clock(.88)
    rotor = noise(.88, 75, 1500)*(.15+.85*np.sin(2*np.pi*21*t)**8)
    rotor += .25*np.sin(2*np.pi*(85*t+18*t*t)) + .12*np.sin(2*np.pi*173*t)
    rotor *= np.sin(np.pi*t/.88)**1.4
    x = empty(.88)
    place(x, taper(rotor, .05, .13), 0, .75)
    cues["chopperApproach"] = x
    x = empty(.48)
    place(x, taper(noise(.23, 140, 1700)*np.linspace(.05, .9, round(.23*SR)), .01, .035), 0, .25)
    place(x, thud(.28, 57), .18, .75)
    place(x, rim(.18, 164), .22, .17)
    cues["cargoDrop"] = x
    cues["multiplierBoost"] = chord_cue([56, 63, 68], .57, .06)
    x = empty(.28)
    t = clock(.28)
    place(x, taper(noise(.28, 250, 2800)*np.exp(-t*21), .003, .04), 0, .32)
    for at, f in [(0, 270), (.036, 340), (.071, 415)]:
        place(x, metal(.17, f), at, .20, -.22+at*6)
    cues["cascadeBreak"] = x
    x = empty(.29)
    for i in range(3):
        place(x, thud(.20, 70+i*5), .032*i, .43, -.17+i*.17)
    cues["cascadeLand"] = x
    t = clock(.94)
    motor = (np.sin(2*np.pi*(47*t+43*t*t)) + .25*np.sin(2*np.pi*(94*t+86*t*t)))
    wake = noise(.94, 120, 2200)*.36
    x = empty(.94)
    place(x, taper((motor+wake)*np.sin(np.pi*t/.94)**.65, .018, .13), 0, .75)
    cues["getawayLaunch"] = x
    # A resolved F-minor/9 chord and low drum answer, never a repeated alarm or siren.
    cues["getawayWin"] = chord_cue([41, 53, 56, 60, 67, 72], 1.70, .065, 29)
    place(cues["getawayWin"], thud(.36, 54), .34, .36)
    x = empty(.68)
    place(x, thud(.38, 51), .02, .32)
    place(x, keys(41, .60), 0, .26)
    place(x, taper(noise(.48, 100, 1100)*np.linspace(.7, 0, round(.48*SR)), .012, .05), .08, .14)
    cues["getawayLoss"] = x
    # Existing bonus-entry mapping remains available for legacy mode callers.
    x = chord_cue([41, 53, 60, 63], 1.20, .07)
    place(x, rotor, .08, .15)
    cues["chopperEnter"] = x
    return {name: finish(audio, .72) for name, audio in cues.items()}


def encode(name, audio, temporary):
    wav = temporary / (name + ".wav")
    with wave.open(str(wav), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SR)
        output.writeframes(np.round(np.clip(audio, -.99, .99)*32767).astype("<i2").tobytes())
    path = OUT / (name + ".ogg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-fflags", "+bitexact", "-i", str(wav),
                    "-map_metadata", "-1", "-c:a", "libvorbis", "-q:a", "5",
                    "-flags:a", "+bitexact", str(path)], check=True)
    decoded = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path),
                                       "-f", "f32le", "-acodec", "pcm_f32le", "-"])
    pcm = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2)
    return {"file": path.name, "seconds": round(len(pcm)/SR, 6),
            "peak": round(float(np.max(np.abs(pcm))), 6),
            "rms": round(float(np.sqrt(np.mean(pcm**2))), 6),
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory(prefix="kilo-v54-audio-") as tmp:
        temporary = Path(tmp)
        base = None
        for kind in ["base", "spin", "feature", "chopper"]:
            music = music_bed(kind)
            rows.append(encode("bed-" + kind, music, temporary))
            if kind == "base":
                base = music
        intro = base[:round(4*4*BEAT*SR)].copy()
        place(intro, keys(65, 2.5), .05, .14, -.2)
        place(intro, keys(68, 2.5), .13, .14, .2)
        rows.append(encode("bed-intro", finish(intro, .52), temporary))
        seconds = 8*BEAT
        t = clock(seconds)
        tension = empty(seconds)
        pulses = (.28+.72*np.sin(2*np.pi*3.5*t)**8)
        body = (.45*np.sin(2*np.pi*freq(29)*t)+.14*np.sin(2*np.pi*freq(36)*t))
        air = noise(seconds, 180, 1600)*.16
        place(tension, taper((body+air)*pulses*np.linspace(.22, .72, len(t)), .08, .15), 0)
        rows.append(encode("stem-tension", finish(tension, .49), temporary))
        cues = cue_designs()
        gap = .08
        sprite = empty(sum(len(x)/SR+gap for x in cues.values())+gap)
        offset = round(gap*SR)
        mapping = {}
        for name, cue in cues.items():
            sprite[offset:offset+len(cue)] = cue
            mapping[name] = [round(offset/SR*1000, 6), round(len(cue)/SR*1000, 6)]
            offset += len(cue)+round(gap*SR)
        rows.append(encode("sfx", sprite, temporary))
        (OUT / "sfx.json").write_text(json.dumps(mapping, indent=2)+"\n")
    (OUT / "manifest-v54.json").write_text(json.dumps({
        "version": 54, "original": True, "sampleRate": SR, "channels": 2,
        "bpm": BPM, "barsPerBed": BARS, "key": "F minor", "cueCount": len(mapping),
        "generator": "scripts/build-kilo-audio-v54.py", "files": rows,
    }, indent=2)+"\n")
    table = "\n".join(f"| {row['file']} | {row['seconds']:.3f} | {row['peak']:.3f} | {row['rms']:.3f} | {row['bytes']:,} |" for row in rows)
    REPORT.write_text(f"""# Kilo King v54 audio delivery

The v53 source, built site and deployment archive had none of the eight referenced `/kilo-audio` resources. This pack restores all eight resources and adds distinct VS, cargo, tumble and Getaway cues.

## Authorship and scope

Original deterministic synthesis: no samples, recordings, copyrighted melodies or provider audio. Soft electric-key voicings, restrained F-minor bass and wood/skin percussion at {BPM} BPM. Four phase-aligned {BARS}-bar beds ({LOOP:.6f} seconds) support uninterrupted crossfades. The intro is a four-bar one-shot. The tension stem ends; rotor and motor effects do not loop.

Sound effects use damped metal, wood, crate impacts, filtered air, reel tension and engine/wake layers. {len(mapping)} named cues preserve the existing sound API and add eleven feature cues. Every sound has a finite envelope, and stereo placement is restrained.

This is original synthesized sound design. It has been decoded and checked numerically; it has **not** been listened to in a browser or certified for perceptual mix quality. A listening pass on phone speakers and headphones remains necessary.

## Decoded delivery measurements

44.1 kHz stereo Ogg Vorbis. Peaks below 1.0 are not clipped. Individual files retain headroom; simultaneous browser playback still requires listening and mix review.

| File | Seconds | Peak | RMS | Bytes |
|---|---:|---:|---:|---:|
{table}

## APIs and behavior

- `featureCue(name: FeatureCueName)` accepts `vsLatch`, `reelPull`, `cargoLock`, `chopperApproach`, `cargoDrop`, `multiplierBoost`, `cascadeBreak`, `cascadeLand`, `getawayLaunch`, `getawayWin`, `getawayLoss`.
- `bonusEnter(mode?, feature?)` accepts actual feature identity in either position. `route` and legacy `chopper` use the Chopper bed. Yacht uses the feature entry; Getaway uses its launch cue. Both use the feature bed; event-specific cues are supplied by the renderer.
- Existing sprite names and collection calls remain available. No currency, event amount, wallet, settlement or game mathematics is changed.
- Reduced motion does not mute sound. Music/effects volume and explicit mute continue to control audio independently.
- Failed loads do not permanently cache the failure; the next user gesture can retry. Readiness is true only after the map and all audio buffers have loaded and the sprite ranges have been validated.

## Reproduction and verification

`python scripts/build-kilo-audio-v54.py` rebuilds the original sound pack with a fixed RNG seed. Python, numpy, scipy, ffmpeg and libvorbis are required. `node scripts/verify-audio-v54.mjs` checks source completeness, map coverage, decoded peaks, duration/ranges, retry behavior and reduced-motion independence. `node scripts/verify-audio-v54.mjs --dist` also requires the exact assets in `dist/kilo-audio` after the normal site build.

SHA-256 checksums and numeric measurements are recorded in `public/kilo-audio/manifest-v54.json`. No deployment is performed by either script.
""")
    print(json.dumps({"directory": str(OUT), "cueCount": len(mapping), "files": rows}, indent=2))


if __name__ == "__main__":
    main()
