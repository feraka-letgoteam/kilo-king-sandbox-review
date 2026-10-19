"""Mix shipped cue ranges at times emitted by the actual effect controller."""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
timeline=json.loads(Path(sys.argv[1]).read_text())
mapping=json.loads(Path('public/kilo-audio/sfx.json').read_text())
source=Path('src/lib/kilo/sound.ts').read_text()
gains={k:float(v) for k,v in re.findall(r'((?:vs|boat|getaway)\w+):\s*([.\d]+)',source)}
gains.update(collect=.7,level=.75)
pcm=subprocess.check_output(['ffmpeg','-v','error','-i','public/kilo-audio/sfx.ogg','-f','f32le','-acodec','pcm_f32le','-'])
pcm=np.frombuffer(pcm,dtype='<f4').reshape(-1,2)
mix=np.zeros((round(timeline['durationMs']/1000*44100),2))
for event in timeline['cues']:
    start,length=mapping[event['name']]
    clip=pcm[round(start/1000*44100):round((start+length)/1000*44100)]
    offset=round(event['ms']/1000*44100)
    count=min(len(clip),len(mix)-offset)
    mix[offset:offset+count]+=clip[:count]*gains.get(event['name'],.8)*.7
assert np.max(np.abs(mix))<.99
with wave.open(sys.argv[2],'wb') as out:
    out.setnchannels(2);out.setsampwidth(2);out.setframerate(44100)
    out.writeframes(np.round(mix*32767).astype('<i2').tobytes())
