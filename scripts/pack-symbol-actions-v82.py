"""Pack authored ImageGen drawings; registration and encoding only.

No painting, recolouring, procedural replacement artwork, or source-symbol edits.
Every action shares one source-sized registration and exact source endpoints.
"""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import hashlib, json, numpy as np

ROOT=Path(__file__).resolve().parents[1]
GEN=ROOT.parent/'generated_images'
OUT=ROOT/'public/kilo-v82'
DOC=ROOT/'art/kilo-v82/symbols'
DOC.mkdir(parents=True,exist_ok=True)
for folder in ('symbols','surfaces'):(OUT/folder).mkdir(parents=True,exist_ok=True)
SYMBOLS=json.loads((ROOT/'public/kilo-v79/symbols/manifest.json').read_text())['symbols']

def ink(im):return im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()

def frames(source,cols,rows):
    """Extract complete authored poses, including those crossing nominal cells.

    Generated sheet spacing is not a raster contract. Connected alpha islands
    identify each composition without clipping a paper fan at a grid boundary.
    """
    im=Image.open(source).convert('RGBA');a=np.asarray(im)[:,:,3]>16
    labels,n=ndimage.label(a);areas=np.bincount(labels.ravel());objects=ndimage.find_objects(labels)
    seeds={};islands=[];cw,ch=im.width/cols,im.height/rows
    for label in range(1,n+1):
        if areas[label]<8:continue
        yy,xx=objects[label-1];box=(xx.start,yy.start,xx.stop,yy.stop)
        center=((xx.start+xx.stop)/2,(yy.start+yy.stop)/2)
        cell=min(rows-1,int(center[1]/ch))*cols+min(cols-1,int(center[0]/cw))
        islands.append((label,box,center))
        if cell not in seeds or areas[label]>areas[seeds[cell][0]]:seeds[cell]=(label,box,center)
    assert len(seeds)==cols*rows,(source,len(seeds))
    groups={i:[] for i in seeds}
    for label,box,center in islands:
        cell=min(seeds,key=lambda k:((center[0]-seeds[k][2][0])/cw)**2+((center[1]-seeds[k][2][1])/ch)**2)
        groups[cell].append(box)
    result=[]
    for i in range(cols*rows):
        boxes=groups[i]
        bb=(max(0,min(b[0] for b in boxes)-2),max(0,min(b[1] for b in boxes)-2),
            min(im.width,max(b[2] for b in boxes)+2),min(im.height,max(b[3] for b in boxes)+2))
        result.append((im.crop(bb),bb))
    return im,result

specs=[
 ('sym-cash-roll','exec-7d372147-7d32-445f-a477-d6b90a48c8b8.png','Banknotes fan from a fixed binding, fold and settle.',[35,70,70,100,90,110,50]),
 ('sym-reel-v8','exec-3c5d5e07-830d-4b91-887c-b1f73bad795a.png','Crank winds against taut line, releases, recovers.',[35,85,80,65,75,125,50]),
 ('sym-case-v8','exec-d3ada311-10f9-47fd-b74b-082a66fc7503.png','Lid hinges, lure swings, notes lift and fall.',[35,85,70,95,85,110,50]),
 ('package-small','exec-ffac05ee-7703-4d8d-aa65-5718fd93d9f5.png','Sealed bag crinkles and powder settles within it.',[35,85,75,75,85,100,50]),
 ('package-medium','exec-77b5c4ac-e224-4d38-86b0-651bdc1c1d91.png','Single brick compresses; tape end flicks and settles.',[35,90,70,75,80,110,50]),
 ('package-trophy','exec-5fdb4ec9-bfb7-47ac-b3c4-b5b2fd93093d.png','Upper package responds above planted lower pair.',[35,95,80,80,80,115,50]),
 ('package-king','exec-11b83657-9d24-400e-863a-55873f09f5c6.png','Six-package stack has a restrained upper-row settle.',[35,95,90,85,85,120,50]),
]

clips={};provenance=[]
for key,filename,description,durations in specs:
    source=GEN/filename;raw,drawings=frames(source,3,2)
    ref=SYMBOLS[key];old=Image.open(ROOT/f'public/kilo-v79/symbols/{key}.webp').convert('RGBA')
    size=512;base=old.resize((size,size),Image.Resampling.LANCZOS)
    reg=tuple(v*size/ref['width'] for v in ref['bounds'])
    first,firstbox=drawings[0]
    # A single scale is shared by all authored poses; no per-pose fit can erase
    # the paper fan, compression, strap articulation or cargo weight response.
    factor=min((reg[2]-reg[0])/first.width,(reg[3]-reg[1])/first.height)
    target=((reg[0]+reg[2])/2,reg[3])
    atlas=Image.new('RGBA',(2048,1024));packed=[base]
    for i,(drawing,box) in enumerate(drawings):
        frame=Image.new('RGBA',(size,size))
        dw,dh=round(drawing.width*factor),round(drawing.height*factor)
        placed=drawing.resize((dw,dh),Image.Resampling.LANCZOS)
        x=round(target[0]-dw/2);y=round(target[1]-dh)
        # Chassis axle and bound-roll centre are stronger registration anchors
        # than changing alpha silhouettes for articulated hardware and paper.
        if key=='sym-reel-v8':
            axles=[(164,261),(675,260),(1190,262),(165,782),(682,781),(1192,782)]
            ax,ay=axles[i];x=round(163-(ax-box[0])*factor);y=round(234-(ay-box[1])*factor)
        elif key=='sym-cash-roll':
            rolls=[(195,339),(705,340),(1210,339),(195,874),(707,874),(1212,875)]
            ax,ay=rolls[i];x=round(164-(ax-box[0])*factor);y=round(302-(ay-box[1])*factor)
        assert x>=0 and y>=0 and x+dw<=size and y+dh<=size,(key,i,(x,y,dw,dh))
        frame.alpha_composite(placed,(x,y));packed.append(frame)
    for i,frame in enumerate(packed):atlas.alpha_composite(frame,(i%4*size,i//4*size))
    file=OUT/'symbols'/f'{key}-action.webp';atlas.save(file,'WEBP',quality=91,method=6)
    bounds=[ink(frame) for frame in packed];union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    clips[key]={'url':f'/kilo-v82/symbols/{file.name}','width':2048,'height':1024,
       'frames':[{'x':i%4*size,'y':i//4*size,'w':size,'h':size} for i in range(len(packed))],
       'bounds':union,'registrationBounds':reg,'reference':{k:ref[k] for k in ('width','height','bounds')},
       # Use original artwork at both ends; generated first/last remain source
       # provenance/registration poses and are not additional live replacements.
       'sequence':[0,2,3,4,5,6,0],'durations':durations}
    provenance.append({'key':key,'generatedFile':filename,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'action':description,'frameExtraction':[list(box) for _,box in drawings],
        'sharedScale':factor,'staticEndpoint':f'/kilo-v79/symbols/{key}.webp','bytes':file.stat().st_size})

surface_specs=[
 ('dock','exec-60fbe6a9-1210-4129-9eaa-e8d9a80748b6.png','Hook load, case lift, water peel, settle.',[35,140,180,180,140,55]),
 ('yacht','exec-ef9f331f-75e7-4ed5-be4c-69a8cbc4b0ad.png','Opponents ready, shoulder check, prop response, settle; cuff-grip correction.',[35,160,190,170,170,55]),
 ('completion','exec-6b8dd400-2fcd-4056-b599-48741e81cdef.png','Crown rises, cash responds, weight lands, settles.',[35,120,150,170,160,55]),
]
surfaces={}
for key,filename,description,durations in surface_specs:
    source=GEN/filename;raw,drawings=frames(source,2,2)
    old=Image.open(ROOT/f'public/kilo-v79/surfaces/{key}.webp').convert('RGBA');old=old.resize((768,512),Image.Resampling.LANCZOS)
    reg=ink(old);first,_=drawings[0]
    factor=min((reg[2]-reg[0])/first.width,(reg[3]-reg[1])/first.height)
    # Source crest art already reaches its top edge. Reserve small articulation
    # room using the same one-time source registration for every action pose.
    factor*=.94
    target=((reg[0]+reg[2])/2,(reg[1]+reg[3])/2)
    packed=[old]
    for drawing,_ in drawings:
        frame=Image.new('RGBA',(768,512));dw,dh=round(drawing.width*factor),round(drawing.height*factor)
        # Fix crest baseline to source; the independently redrawn internal
        # elements provide action, not an animated UI container.
        x=round(target[0]-dw/2);y=round(reg[3]-dh)
        if y<0:
            factor2=(reg[3]-8)/drawing.height;dw,dh=round(drawing.width*factor2),round(drawing.height*factor2);x=round(target[0]-dw/2);y=round(reg[3]-dh)
        assert x>=0 and y>=0 and x+dw<=768 and y+dh<=512,(key,x,y,dw,dh)
        frame.alpha_composite(drawing.resize((dw,dh),Image.Resampling.LANCZOS),(x,y));packed.append(frame)
    atlas=Image.new('RGBA',(2304,1024))
    for i,frame in enumerate(packed):atlas.alpha_composite(frame,(i%3*768,i//3*512))
    file=OUT/'surfaces'/f'{key}-action.webp';atlas.save(file,'WEBP',quality=91,method=6)
    b=[ink(frame) for frame in packed]
    surfaces[key]={'url':f'/kilo-v82/surfaces/{file.name}','width':2304,'height':1024,
       'frames':[{'x':i%3*768,'y':i//3*512,'w':768,'h':512} for i in range(len(packed))],
       'bounds':[min(v[0] for v in b),min(v[1] for v in b),max(v[2] for v in b),max(v[3] for v in b)],
       'registrationBounds':reg,'reference':{'width':768,'height':512,'bounds':reg},
       'sequence':[0,1,2,3,4,0],'durations':durations}
    provenance.append({'key':key,'generatedFile':filename,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
       'action':description,'frameExtraction':[list(box) for _,box in drawings],'staticEndpoint':f'/kilo-v79/surfaces/{key}.webp','bytes':file.stat().st_size})

(OUT/'symbols/manifest.json').write_text(json.dumps({'clips':clips},indent=2)+'\n')
(OUT/'surfaces/manifest.json').write_text(json.dumps({'clips':surfaces},indent=2)+'\n')
(DOC/'generation-provenance.json').write_text(json.dumps({'tool':'built-in image_gen','assets':provenance,'publicBytes':sum(i['bytes'] for i in provenance)},indent=2)+'\n')
print(json.dumps({'symbolClips':len(clips),'surfaceClips':len(surfaces),'publicBytes':sum(i['bytes'] for i in provenance)}))
