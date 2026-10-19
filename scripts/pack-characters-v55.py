#!/usr/bin/env python3
"""Pack generated, fully drawn parts. No retouching, masks or painted pixels.

Cropping, resampling, atlas packing and diagnostic rig assembly only.
"""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/kilo-v55/characters'
PUBLIC=ROOT/'public/kilo-v55/characters'
IDS=['hips','torso','head','upperArmL','forearmL','upperArmR','forearmR','prop','headWin']
# Boxes enclose all generated edge antialiasing around the large isolated shapes.
BOXES={
 'king':[(47,30,446,429),(471,42,815,427),(877,75,1174,402),(119,455,326,790),(551,449,741,797),(917,449,1140,790),(119,819,324,1198),(553,805,734,1233),(876,864,1176,1194)],
 'vice':[(50,33,450,458),(483,76,815,440),(903,88,1193,444),(128,504,348,831),(545,534,787,818),(922,505,1145,833),(113,859,349,1192),(547,862,690,1192),(898,857,1198,1222)]
}

SPECS={
 'king':[
  ((244,244),(122,23),(192,331),None,0,0),
  ((190,212),(95,192),(0,0),'hips',0,3),
  ((137,151),(68,140),(0,-156),'torso',0,5),
  ((75,122),(39,24),(-69,-141),'torso',-.12,4),
  ((68,124),(28,23),(-4,81),'upperArmL',-.98,7),
  ((77,118),(39,24),(67,-137),'torso',.08,1),
  ((68,124),(37,24),(1,80),'upperArmR',.76,6),
  ((68,161),(16,143),(8,83),'forearmL',1.28,8),
  ((137,151),(68,140),(0,-156),'torso',0,5)
 ],
 'vice':[
  ((236,244),(118,23),(192,331),None,0,0),
  ((190,209),(95,190),(0,0),'hips',0,3),
  ((125,157),(64,145),(0,-157),'torso',0,5),
  ((80,122),(40,24),(-67,-138),'torso',.12,4),
  ((84,119),(31,22),(-1,81),'upperArmL',.30,7),
  ((79,120),(40,24),(68,-135),'torso',-.14,1),
  ((74,123),(39,24),(0,81),'upperArmR',.45,6),
  ((37,86),(20,63),(-5,82),'forearmR',-.40,8),
  ((125,157),(64,145),(0,-157),'torso',0,5)
 ]
}

def rig_world(parts,pose):
 out={}
 for id in IDS:
  p=parts[id]; parent=out.get(p['parent']); x,y=p['position']; r=p['rotation']+pose.get(id,0)
  if parent:
   px,py,pr=parent; c,s=math.cos(pr),math.sin(pr)
   x,y=px+c*x-s*y,py+s*x+c*y; r+=pr
  out[id]=(x,y,r)
 return out

def assembled(manifest,textures,pose=None,head='head',prop=True):
 out=Image.new('RGBA',(384,576)); parts=manifest['parts']; world=rig_world(parts,pose or {})
 for id,p in sorted(parts.items(),key=lambda it:it[1]['zOrder']):
  if id in ['head','headWin'] and id!=head:continue
  if id=='prop' and not prop:continue
  tex=textures[id];px,py=p['pivot'];x,y,r=world[id]; c,s=math.cos(r),math.sin(r)
  # inverse mapping from output canvas to each generated part's pixels
  coeff=(c,s,px-c*x-s*y,-s,c,py+s*x-c*y)
  layer=tex.transform((384,576),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC)
  out.alpha_composite(layer)
 return out

def pack(who):
 source=Image.open(ART/f'{who}-rig-source.png').convert('RGBA')
 target=PUBLIC/who;target.mkdir(parents=True,exist_ok=True)
 atlas=Image.new('RGBA',(768,768)); parts={};textures={}
 for i,id in enumerate(IDS):
  size,pivot,pos,parent,rotation,z=SPECS[who][i]
  crop=source.crop(BOXES[who][i]);tex=crop.resize(size,Image.Resampling.LANCZOS)
  x=(i%3)*256+8;y=(i//3)*256+8
  atlas.alpha_composite(tex,(x,y));textures[id]=tex
  parts[id]={'frame':{'x':x,'y':y,'w':size[0],'h':size[1]},'pivot':list(pivot),'position':list(pos),'rotation':rotation,'parent':parent,'zOrder':z,'sourceCrop':list(BOXES[who][i])}
  if id in ['prop','headWin']:parts[id]['optional']=True
 manifest={'version':1,'id':who,'canvas':{'width':384,'height':576},'baseline':552,'atlas':f'/kilo-v55/characters/{who}/parts.webp','source':f'art/kilo-v55/characters/{who}-rig-source.png','parts':parts,'defaultHead':'head','alternateHead':'headWin','defaultProp':who=='king','coordinateNotes':'All pivots, positions, and frame sizes are logical pixels. position is relative to the parent joint, before child rotation. rotation is radians. Sort visible sprites by zOrder; hierarchy transforms apply even when sprites are globally sorted. Mirror actor at container level if needed, never swap arm labels. L/R are viewer-left/viewer-right.'}
 atlas.save(target/'parts.webp','WEBP',lossless=True,method=6)
 (target/'rig.json').write_text(json.dumps(manifest,indent=2)+'\n')
 atlas.save(ART/f'{who}-atlas.png')
 poses={'rest':{},'action':{'torso':-.07 if who=='king' else .05,'head':.06 if who=='king' else -.04,'upperArmL':-.18 if who=='king' else .18,'forearmL':-.25 if who=='king' else .65,'upperArmR':.06,'forearmR':-.24,'prop':.50 if who=='king' else 0}}
 manifest['diagnosticPoses']=poses
 (target/'rig.json').write_text(json.dumps(manifest,indent=2)+'\n')
 for name,pose in poses.items():
  im=assembled(manifest,textures,pose,head='headWin' if name=='action' else 'head',prop=who=='king')
  im.save(ART/f'{who}-{name}-assembly.png')
 return manifest,textures

def main():
 actors={who:pack(who) for who in ['king','vice']}
 # Four normalized views at authored assembly scale plus true size phone comparisons.
 board=Image.new('RGB',(1024,830),'#173e48');d=ImageDraw.Draw(board)
 for i,who in enumerate(['king','vice']):
  for j,pose in enumerate(['rest','action']):
   im=Image.open(ART/f'{who}-{pose}-assembly.png');x=20+(i*2+j)*250
   d.text((x,12),f'{who.upper()} {pose.upper()}',fill='#fff5df')
   board.paste(im.resize((240,360),Image.Resampling.LANCZOS),(x,32),im.resize((240,360),Image.Resampling.LANCZOS))
   for w,h,y in [(128,192,420),(72,108,660)]:
    small=im.resize((w,h),Image.Resampling.LANCZOS);board.paste(small,(x+24,y),small)
    d.text((x+24,y+h+8),f'{w} x {h}',fill='#fff5df')
 board.save(ART/'assembly-contact-sheet.png')
 print('Packed king and vice with real alpha; wrote assembly-contact-sheet.png')

if __name__=='__main__':main()
