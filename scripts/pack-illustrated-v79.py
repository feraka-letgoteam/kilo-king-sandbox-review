"""Register generated art only: uniform fits, frame extraction, WebP encoding.
No painting, segmentation, color replacement or procedural substitute artwork.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
GEN = Path('/workspace/scratch/6281bb86619d/generated_images')
PROV = json.loads((ROOT/'art/kilo-v79/final-symbol-generation.json').read_text())
OUT = ROOT/'public/kilo-v79/symbols'
OUT.mkdir(exist_ok=True, parents=True)
royals = {'10':'exec-b523d7d7-bbd2-426c-bcc5-84f721f4deb7.png',
 'j':'exec-834047f6-d941-4335-a696-549f7999cc4c.png','q':'exec-41976a46-7b77-4596-a156-4933bbe12b15.png',
 'k':'exec-d9787026-b26c-4871-9c38-d57f4b46600d.png','a':'exec-49042178-0466-4c57-850a-e327c9ccb66b.png'}
def ink(im): return im.getchannel('A').point(lambda v: 255 if v>16 else 0).getbbox()
def registered(source, reference, target):
 im=Image.open(source).convert('RGBA');old=Image.open(reference).convert('RGBA')
 nb,ob=ink(im),ink(old);crop=im.crop(nb)
 scale=min((ob[2]-ob[0])/crop.width,(ob[3]-ob[1])/crop.height)
 crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
 output=Image.new('RGBA',old.size)
 output.alpha_composite(crop,(round((ob[0]+ob[2]-crop.width)/2),round((ob[1]+ob[3]-crop.height)/2)))
 output.save(target,'WEBP',quality=94,method=6)
 return {'file':target.name,'width':output.width,'height':output.height,'bounds':list(ink(output)),
   'source':str(source),'referenceBounds':ob,'registration':'Uniform scale to previous ink budget; alpha preserved'}
# Retain the separately authored, registered collector pack on a repeat run.
prior=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {}
manifest={'symbols':{},'clips':{}}
if 'collector' in prior.get('clips',{}):manifest['clips']['collector']=prior['clips']['collector']
for n,f in royals.items():
 name='sym-'+n;manifest['symbols'][name]=registered(GEN/f,ROOT/f'public/kilo-symbols-v47/{name}.webp',OUT/(name+'.webp'))
for name in ['sym-bobber','sym-cash-roll','sym-reel-v8','sym-case-v8','package-small','package-medium','package-trophy','package-king','scatter-king']:
 source=PROV[name+'-final' if name.startswith('package') else name]['source']
 manifest['symbols'][name]=registered(source,ROOT/f'public/kilo-v55/symbols/{name}.webp',OUT/(name+'.webp'))

# Six authored drawings share a single atlas registration; no dynamic resizing
# of individual frames (which would erase purposeful squash and articulation).
for clipname,key in [('reel-reaction','sym-reel-v8'),('case-reaction','sym-case-v8'),('bobber-reaction','sym-bobber')]:
 im=Image.open(PROV[clipname]['source']).convert('RGBA');fw,fh=512,512
 atlas=im.resize((fw*3,fh*2),Image.Resampling.LANCZOS)
 bounds=[ink(atlas.crop((i%3*fw,i//3*fh,i%3*fw+fw,i//3*fh+fh))) for i in range(6)]
 union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
 atlas.save(OUT/(clipname+'.webp'),'WEBP',quality=94,method=6)
 ref=manifest['symbols'][key]
 manifest['clips'][key]={'url':f'/kilo-v79/symbols/{clipname}.webp','width':1536,'height':1024,
  'frames':[{'x':i%3*fw,'y':i//3*fh,'w':fw,'h':fh} for i in range(6)],'bounds':union,
  'reference':{k:ref[k] for k in ['width','height','bounds']},'sequence':[0,1,2,3,4,5],
  'durations':[70,80,85,85,90,110]}

fx=ROOT/'public/kilo-v79/fx';fx.mkdir(exist_ok=True)
for name in ['fx-burst','fx-water-impact']:
 registered(PROV[name]['source'],ROOT/f'public/kilo-night-v3/{name}.png',fx/(name+'.webp'))
vehicles=ROOT/'public/kilo-v79/vehicles';vehicles.mkdir(exist_ok=True)
im=Image.open(PROV['chopper-action']['source']).convert('RGBA')
# Each generated cell is fit to the previous frame ink with a single rigid scale.
# Cargo/drop and rotor landmarks keep their established runtime coordinates.
old=Image.open(ROOT/'public/kilo-v55/vehicles/chopper-action.webp').convert('RGBA')
canvas=Image.new('RGBA',old.size)
for i in range(8):
 box=(i%4*512,i//4*320,i%4*512+512,i//4*320+320)
 srcbox=(round(i%4*im.width/4),round(i//4*im.height/2),round((i%4+1)*im.width/4),round((i//4+1)*im.height/2))
 frame=im.crop(srcbox);nb=ink(frame);ob=ink(old.crop(box));crop=frame.crop(nb)
 scale=min((ob[2]-ob[0])/crop.width,(ob[3]-ob[1])/crop.height)
 crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS)
 canvas.alpha_composite(crop,(box[0]+round((ob[0]+ob[2]-crop.width)/2),box[1]+round((ob[1]+ob[3]-crop.height)/2)))
canvas.save(vehicles/'chopper-action.webp','WEBP',quality=94,method=6)
canvas.crop((512,0,1024,320)).save(vehicles/'chopper-body.webp','WEBP',quality=94,method=6)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Registered 14 symbols, 18 authored symbol frames, 8 Chopper frames and 2 FX textures.')
