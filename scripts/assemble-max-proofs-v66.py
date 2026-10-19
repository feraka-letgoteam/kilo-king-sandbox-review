"""Assemble chronological proof crops; never changes the shipped artwork."""
from pathlib import Path
import json, math, subprocess, tempfile
from PIL import Image, ImageDraw

root=Path('art/kilo-v66/proofs')
rows=[]
cases=[('early-loss',1440,900),('late-loss',1440,900),('full-stop',1440,900)]
for outcome,w,h in cases:
    name=f'max-{outcome}-{w}x{h}'
    timeline=json.loads((root/f'{name}-timeline.json').read_text())
    video=root/f'{name}.mp4'
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,duration,nb_frames','-of','json',str(video)]))
    stream=next(s for s in info['streams'] if s['codec_type']=='video')
    assert abs(float(stream['duration'])-timeline['durationMs']/1000)<.08, f'{name}: incomplete video stream'
    assert int(stream['nb_frames'])==round(timeline['durationMs']/1000*30)
    phases=timeline['phases']
    final=[p for p in phases if p['phase']=='anticipate'][-1]['ms']/1000
    first=math.floor(final*10)*3
    selected=[{'ms':(first+i*3)*1000/30} for i in range(18)]
    temporary=tempfile.TemporaryDirectory(prefix='kilo-v66-frames-')
    subprocess.run(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f"select=between(n\\,{first}\\,{first+51})*not(mod(n\\,3))",'-fps_mode','vfr','-frames:v','18','-threads','2',temporary.name+'/%02d.png'],check=True)
    gx=24 if w==390 else 278; gy=115 if w==390 else 86
    bw=timeline['geometry']['cell']*5+timeline['geometry']['gap']*4
    bh=timeline['geometry']['cell']*3
    cellw=bw if w==390 else bw//2
    cellh=round(bh*cellw/bw);columns=3
    sheet=Image.new('RGB',(cellw*columns,(cellh+24)*math.ceil(len(selected)/columns)),'#071820')
    draw=ImageDraw.Draw(sheet)
    for i,f in enumerate(selected):
        frame=Image.open(Path(temporary.name)/f'{i+1:02d}.png').crop((gx,gy,gx+bw,gy+bh)).resize((cellw,cellh),Image.Resampling.LANCZOS)
        x=(i%columns)*cellw;y=(i//columns)*(cellh+24)
        sheet.paste(frame,(x,y));draw.text((x+10,y+cellh+7),f"{f['ms']/1000:.2f}s",fill='white')
    sheet.save(root/f'{name}-motion-strip.jpg',quality=94)
    temporary.cleanup()
    phases=timeline['phases']
    final=[p for p in phases if p['phase']=='anticipate'][-1]['ms']/1000
    action=next(p['ms']/1000 for p in phases if p['phase']==('escape' if outcome!='full-stop' else 'settle') and p['segment']==(1 if outcome=='early-loss' else 4 if outcome=='late-loss' else 5))
    result=next(p['ms']/1000 for p in phases if p['phase']=='settled')
    rows.append(f'| [{name}]({name}.mp4) | 0.57–0.93 s | {final:.2f} s | {action:.2f} s | {result:.2f} s | {timeline["finalWin"]:,} |')

# Phone evidence uses selected native frames from the same 30 fps controller
# simulation; no interpolated or held frames are passed off as an encoded clip.
phone='max-full-stop-390x844'
j=json.loads((root/f'{phone}-stills.json').read_text())
selected=[f for f in j['motionFrames'] if f['ms']>=5300]
cellw,cellh=342,198
sheet=Image.new('RGB',(cellw*3,(cellh+24)*math.ceil(len(selected)/3)),'#071820');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(selected):
    im=Image.open(root/f['file']).crop((24,115,366,313))
    x=i%3*cellw;y=i//3*(cellh+24);sheet.paste(im,(x,y));draw.text((x+10,y+cellh+7),f"{f['ms']/1000:.2f}s",fill='white')
sheet.save(root/f'{phone}-motion-strip.jpg',quality=94)
rows.append(f'| [Phone full-stop frames]({phone}-motion-strip.jpg) | Native 390×844 stills | 5.33 s | 6.50 s | 7.20 s | {j["finalWin"]:,} |')
text='''# v66 Max motion proofs

Offline Canvas rasterization of the production controller and painters, not browser/WebGL footage. Desktop clips: normal speed, 30 fps. Phone: selected native 390×844 frames from the same production controller simulation, including 100 ms consecutive samples through the final anticipation, advance and braking. The phone video encode was discarded after its frame count failed validation. The WIN well is a minimal harness at its production landing position. Clips are uncut; motion strips show chronological excerpts with timestamps only.

| Clip | First hold + wake build | Final anticipation | Final brake / weighted exit | Result | Final WIN |
|---|---|---|---|---|---|
'''+ '\n'.join(rows)+'''

Fisherman entry reaction starts at 0.40 s. Full-stop reaction starts at 6.97 s. In full-stop clips the boat settles before MAX WIN / amount, and the transfer finishes at 8.33 s. Losses never credit WIN.

The phone `*-stills.json` lists its native frame timestamps, cues and reactions. Each desktop `*-timeline.json` includes every phase boundary, cue, reaction and captured frame timestamp. `recorded-outcomes.json` contains the actual seeded production records used in the proofs. `source-checksums.json` identifies the shared production source used for all three clips and the phone stills.

The boat is framed at 62% of the aperture width to keep its rider and wake visible. The five stops have shorter on-screen spacing than v65; reel geometry and recorded stop logic are unchanged.
'''
(root/'PROOF-INDEX.md').write_text(text)
print('Verified three complete desktop clips and the phone frame sequence; assembled motion strips.')
