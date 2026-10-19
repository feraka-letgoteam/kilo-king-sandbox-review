"""Auditable offline mix of shipped audio at source-controller cue timestamps.
Not a recording of a browser AudioContext or hardware latency.
"""
import json,sys,subprocess,pathlib,os,numpy as np
root=pathlib.Path.cwd();manifest=pathlib.Path(sys.argv[1]);data=json.loads(manifest.read_text());rate=24000
clip=manifest.with_suffix('.mp4');subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type','-of','json',str(clip)],stdout=subprocess.DEVNULL,check=True);duration=data['capture']['frames']/data['capture']['fps'];count=int(duration*rate)+1
mix=np.zeros((count,2),dtype=np.float32)
def decode(file):
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ar',str(rate),'-ac','2','pipe:1'])
 return np.frombuffer(raw,dtype=np.float32).reshape(-1,2)
sfx=decode(root/'public/kilo-audio/sfx.ogg');mapping=json.loads((root/'public/kilo-audio/sfx.json').read_text())
beds={key:decode(root/f'public/kilo-audio/bed-{key}.ogg') for key in ['base','spin','feature']}
changes=[(0,'base')];events=[];active=False;land=0;lastspin=-1e6
feature_gain={'boatThrust':.38,'boatCoast':.30,'boatBrake':.42,'boatPass':.36,'vsReady':.42,'vsPull':.40,'vsImpact':.55,'vsLock':.58,'vsConnect':.38,'vsAmount':.40,'vsTransfer':.32,'vsBank':.42,'vsLatch':.68,'reelPull':.48,'cargoLock':.56,'getawayLaunch':.55,'getawayWin':.84,'getawayLoss':.42}
for cue in data['cues']:
 ms=cue['ms'];name=cue['name'];args=cue.get('args',[]);gain=.6;pitch=1
 if name=='bonusEnter':active=True;changes.append((ms,'feature'));name='featureEnter';gain=.8
 elif name=='bonusExit':active=False;changes.append((ms,'base'));continue
 elif name in ['whirStart','cue'] and (name=='whirStart' or args and args[0]=='spin'):
  if ms-lastspin<400:continue
  lastspin=ms;name='spin';gain=.24
  if not active:changes.append((ms,'spin'))
 elif name=='whirStop':changes.append((ms,'feature' if active else 'base'));continue
 elif name=='cue':
  name={'tick':'tick','collect':'collect','tool':'tool','level':'level','end':'featureComplete','win':'winSmall','stop':'land1','scatter':'tick'}.get(args[0] if args else '')
  if not name:continue
 elif name=='winSting':name=['winSmall','winMid','winBig'][min(2,int(args[0]))];gain=.75
 elif name=='landStop':
  land=land%5+1;name='scatter1' if args and args[0] else f'land{land}';gain=.5
 elif name=='teaseResolve':
  if not args or not args[0]:continue
  name='resolve';gain=.8
 elif name=='teaseBegin':continue
 elif name in feature_gain:
  gain=feature_gain[name]
  if name in ['vsLock','vsLatch','vsAmount']:pitch=2**(max(0,cue.get('locks',0)-1)*2/12)
 if name not in mapping:continue
 start,length=mapping[name];a=int(start/1000*rate);b=int((start+length)/1000*rate);audio=sfx[a:b]
 if pitch!=1:
  xp=np.arange(len(audio));x=np.arange(0,len(audio),pitch);audio=np.stack([np.interp(x,xp,audio[:,k]) for k in range(2)],axis=1)
 pos=int(ms/1000*rate);length=min(len(audio),count-pos)
 if length>0:mix[pos:pos+length]+=audio[:length]*gain*.7;events.append({'name':name,'ms':ms,'gain':gain,'rate':pitch})
# Phase-matched 112BPM beds with short equal-power transitions.
changes=sorted(changes);bed=np.zeros_like(mix)
for i,(ms,key) in enumerate(changes):
 start=max(0,int(ms/1000*rate));end=min(count,int(changes[i+1][0]/1000*rate) if i+1<len(changes) else count)
 if end<=start:continue
 track=beds[key];idx=np.arange(start,end)%len(track);bed[start:end]=track[idx]*.30
 fade=min(int(.22*rate),end-start)
 if i and fade:
  previous=beds[changes[i-1][1]];u=np.linspace(0,1,fade)[:,None];old=previous[np.arange(start,start+fade)%len(previous)]*.30
  bed[start:start+fade]=old*np.cos(u*np.pi/2)+bed[start:start+fade]*np.sin(u*np.pi/2)
mix+=bed
peak=float(np.max(np.abs(mix)));scale=min(1,.94/max(peak,1e-6));mix*=scale
raw=manifest.with_suffix('.audio.f32');raw.write_bytes(mix.astype('<f4').tobytes())
out=manifest.with_name(manifest.stem+'-audio.mp4');pending=manifest.with_name(manifest.stem+'-audio.pending.mp4')
try:
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(clip),'-f','f32le','-ar',str(rate),'-ac','2','-i',str(raw),'-c:v','copy','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(pending)],check=True)
 metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','json',str(pending)]));assert int(metadata['streams'][0]['nb_frames'])==data['capture']['frames']
 with pending.open('rb') as saved: os.fsync(saved.fileno())
 pending.replace(out)
finally:
 raw.unlink(missing_ok=True)
data['audioProof']={'file':out.name,'method':'Offline mix of shipped beds and SFX at production-controller timestamps; phase-matched bed approximation, not browser/hardware latency proof.','events':events,'peakBeforeGain':peak,'gain':scale};manifest.write_text(json.dumps(data,indent=2)+'\n');print(out)
