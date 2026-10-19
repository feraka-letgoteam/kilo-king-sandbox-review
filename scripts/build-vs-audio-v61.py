#!/usr/bin/env python3
"""Append original finite VS Foley to the frozen v60 sprite. No sampled audio."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import numpy as np
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('design', ROOT/'scripts/build-kilo-audio-v54.py')
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
d.RNG = np.random.default_rng(610518)
checkpoint = 'e121a0a'
def original(name):
    return subprocess.check_output(['git', 'show', f'{checkpoint}:public/kilo-audio/{name}'], cwd=ROOT)

cues = {}
x = d.empty(.32)
d.place(x, d.thud(.25, 72), 0, .25)
d.place(x, d.metal(.24, 220), .04, .18, -.15)
cues['vsReady'] = d.finish(x, .58)
t = d.clock(.27)
x = d.empty(.32)
d.place(x, d.taper(d.noise(.27, 250, 2800)*np.sin(np.pi*t/.27)**1.4, .02, .03), 0, .15)
for at in [.04, .095, .14, .175]:
    d.place(x, d.rim(.065, 290+at*300), at, .12, .1)
cues['vsPull'] = d.finish(x, .56)
x = d.empty(.25)
d.place(x, d.thud(.23, 62), 0, .45)
d.place(x, d.metal(.22, 610), .012, .23)
cues['vsImpact'] = d.finish(x, .65)
x = d.empty(.36)
d.place(x, d.metal(.30, 470), 0, .30)
d.place(x, d.thud(.23, 91), .025, .30)
d.place(x, d.metal(.18, 940), .10, .08)
cues['vsLock'] = d.finish(x, .62)
x = d.empty(.28)
for at, note in [(0,65),(.065,68),(.13,72)]:
    d.place(x, d.keys(note, .14), at, .12, -.15+at*2)
cues['vsConnect'] = d.finish(x, .50)
x = d.empty(.30)
for note in [53,60,68]:
    d.place(x, d.keys(note, .28), 0, .10)
cues['vsAmount'] = d.finish(x, .53)
x = d.empty(.24)
t = d.clock(.22)
d.place(x, d.taper(d.noise(.22, 900, 4200)*np.sin(np.pi*t/.22)**1.5, .02, .035), 0, .12)
d.place(x, d.keys(72, .15), .075, .04)
cues['vsTransfer'] = d.finish(x, .44)
x = d.empty(.32)
d.place(x, d.thud(.22, 95), 0, .16)
d.place(x, d.keys(65,.30), .015, .12)
d.place(x, d.keys(72,.25), .035, .06)
cues['vsBank'] = d.finish(x, .50)

with tempfile.TemporaryDirectory(prefix='kilo-v61-audio-') as directory:
    temp = Path(directory)
    (temp/'v60.ogg').write_bytes(original('sfx.ogg'))
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(temp/'v60.ogg'),'-f','f32le','-acodec','pcm_f32le','-'])
    old = np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    mapping = json.loads(original('sfx.json'))
    # Preserve old cue offsets; no unrelated bed or cue is remixed.
    offset = len(old) + round(.08*d.SR)
    mix = d.empty(offset/d.SR + sum(len(c)/d.SR+.08 for c in cues.values()))
    mix[:len(old)] = old
    for name, cue in cues.items():
        mix[offset:offset+len(cue)] = cue
        mapping[name] = [round(offset/d.SR*1000,6),round(len(cue)/d.SR*1000,6)]
        offset += len(cue)+round(.08*d.SR)
    row = d.encode('sfx',mix,temp)
    manifest = json.loads(original('manifest-v54.json'))
    manifest['files'] = [row if f['file']=='sfx.ogg' else f for f in manifest['files']]
    manifest.update(cueCount=len(mapping),extensionVersion=61,generator='scripts/build-vs-audio-v61.py',baseCheckpoint=checkpoint)
    (d.OUT/'sfx.json').write_text(json.dumps(mapping,indent=2)+'\n')
    (d.OUT/'manifest-v54.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'added':list(cues),'file':row},indent=2))
