#!/usr/bin/env python3
"""Append original finite motor/water Foley to the frozen v61 sprite. No sampled audio."""
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
d.RNG = np.random.default_rng(620518)
checkpoint = '1d63732'
def original(name):
    return subprocess.check_output(['git', 'show', f'{checkpoint}:public/kilo-audio/{name}'], cwd=ROOT)

cues = {}
def engine(seconds, start, end, wash):
    t=d.clock(seconds);u=t/seconds
    hz=start+(end-start)*(3*u*u-2*u*u*u)
    phase=2*np.pi*np.cumsum(hz)/d.SR
    motor=np.sin(phase)+.30*np.sin(phase*2)+.10*np.sin(phase*4)
    x=d.empty(seconds)
    signal=d.taper(d.filt(motor,1100)*.18+d.noise(seconds,180,1900)*wash,.025,.07)
    d.place(x,signal,0,1)
    return d.finish(x,.52)
cues['boatThrust']=engine(.34,72,124,.045)
cues['boatCoast']=engine(.18,96,58,.06)
cues['boatBrake']=engine(.34,95,38,.09)
x=engine(.68,75,160,.08)
# A single pass, panned left to right; no forever engine loop.
pan=np.linspace(-.5,.7,len(x));x[:,0]*=np.sqrt((1-pan)/2);x[:,1]*=np.sqrt((1+pan)/2)
cues['boatPass']=d.finish(x,.52)

with tempfile.TemporaryDirectory(prefix='kilo-v62-audio-') as directory:
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
    manifest.update(cueCount=len(mapping),extensionVersion=62,generator='scripts/build-boat-audio-v62.py',baseCheckpoint=checkpoint)
    (d.OUT/'sfx.json').write_text(json.dumps(mapping,indent=2)+'\n')
    (d.OUT/'manifest-v54.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'added':list(cues),'file':row},indent=2))
