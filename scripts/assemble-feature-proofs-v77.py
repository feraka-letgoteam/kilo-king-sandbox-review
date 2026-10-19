"""Consecutive proof frames extracted from the native production-render clips.
No element is redrawn or moved in a proof panel.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, subprocess

ROOT=Path('art/kilo-v77/proofs')
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=ImageFont.truetype(font_path,19)
small=ImageFont.truetype(font_path,14)

def extract(video,frame,out):
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-vf',f'select=eq(n\\,{frame})','-frames:v','1',str(out)],check=True)
    return Image.open(out).convert('RGB')

def choose(rows,predicate,fallback=None):
    found=[r for r in rows if predicate(r)]
    return found[len(found)//2] if found else fallback or rows[-1]

for manifest in sorted(ROOT.glob('*.json')):
    data=json.loads(manifest.read_text())
    if not data.get('telemetry'): continue
    video=manifest.with_suffix('.mp4')
    if not video.exists(): continue
    rows=data['telemetry']; name=data['id']; god=name.startswith('god')
    if god:
        final=5 if 'full' in name else 4 if 'late' in name else 2
        pause=choose(rows,lambda r:r.get('card') and r['card']['phase']=='anticipate' and abs(r['card']['segment']-(final-1))<.01 and r['card']['wake']<.01)
        wait=choose(rows,lambda r:r.get('card') and r['card']['phase']=='anticipate' and abs(r['card']['segment']-(final-1))<.01 and r['card']['wake']>.36)
        action=choose(rows,lambda r:r.get('card') and r['card']['phase']=='advance' and r['card']['pitch']<-.08 and final-1<r['card']['segment']<final)
        settle=choose(rows,lambda r:r.get('card') and r['card']['phase']=='settle' and abs(r['card']['segment']-final)<.01 and r['card']['pitch']>.015)
        if 'late' in name:
            settle=choose(rows,lambda r:r.get('card') and r['card']['phase']=='overshoot' and r['card']['segment']>5.3)
        elif 'early' in name:
            settle=choose(rows,lambda r:r.get('card') and r['card']['phase']=='stall' and r['card']['lean']>.08)
        first_result=next(r['ms'] for r in rows if r.get('card') and r['card']['phase']=='result')
        result=min((r for r in rows if r.get('card') and r['card']['phase']=='result'),key=lambda r:abs(r['ms']-(first_result+300)))
        bank=choose(rows,lambda r:r.get('card') and r['card']['phase']=='result' and r['paid']==data['finalWin'] and data['credits']) if data['credits'] else rows[-1]
        early='early' in name
        samples=[('Hold before movement',pause),('Visible bow preload' if early else 'Pressure and wake build',wait),('Bow thrust' if early else 'Thrust and rider lean',action),('Decisive stall' if early else 'Weighted overshoot' if 'late' in name else 'Brake and settle',settle),('Settled result',result),('WIN credited once' if data['credits'] else 'Return to populated reels',bank)]
    else:
        def after(cue,offset=0):
            points=[c['ms'] for c in data['cues'] if c['name']==cue]
            target=points[0]+offset if points else 0
            return min(rows,key=lambda r:abs(r['ms']-target))
        def merging(row):
            reels=[reel for group in row['groups'] for reel in group['reels']]
            return len(reels)>len(set(reels)) and any(n['alpha']>.2 and n['scale']>1.01 for g in row['groups'] for n in g['number'])
        samples=[('Ready',after('vsReady',250)),('Contact',after('vsImpact',30)),('Merge',choose(rows,merging)),('Connection punch',after('vsConnect',230)),('Amount',after('vsAmount',160)),('Single WIN transfer',after('vsBank',80))]
    portrait=data['viewport'][0]<900;columns=2 if god or portrait else 3
    thumb_w=390 if portrait else 600;thumb_h=round(data['viewport'][1]*thumb_w/data['viewport'][0]);bar=44
    sheet=Image.new('RGB',(columns*thumb_w,((len(samples)+columns-1)//columns)*(thumb_h+bar)),(4,15,22));draw=ImageDraw.Draw(sheet)
    for i,(label,row) in enumerate(samples):
        frame_file=ROOT/f'{name}-proof-{i+1}.png';im=extract(video,row['frame'],frame_file)
        # These are exact complete frames, only downsampled to fit the sheet.
        im.thumbnail((thumb_w,thumb_h),Image.Resampling.LANCZOS)
        x=(i%columns)*thumb_w;y=(i//columns)*(thumb_h+bar)
        sheet.paste(im,(x+(thumb_w-im.width)//2,y+bar))
        draw.text((x+12,y+6),label,fill=(246,221,172),font=font)
        draw.text((x+12,y+27),f"{row['ms']/1000:.3f}s · frame {row['frame']}",fill=(163,189,192),font=small)
    out=ROOT/f'{name}-sequence.webp';sheet.save(out,'WEBP',quality=92)
    print(out)
