import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const files=['dock','yacht','route','getaway'].map(x=>`kilo-v56/features/${x}.webp`);
files.push('kilo-v56/vehicles/getaway-stop.webp');
const pixels=JSON.parse(execFileSync('python',['-c',`
from PIL import Image
import json,hashlib
files=${JSON.stringify(files)}
results=[]
for f in files:
 im=Image.open('public/'+f).convert('RGBA');a=im.getchannel('A')
 assert a.getextrema()==(0,255),f
 if '/features/' in f: assert im.size==(768,512),f
 else:
  assert im.size==(2304,576)
  hashes=[]
  for i in range(8):
   tile=im.crop((i%4*576,i//4*288,(i%4+1)*576,(i//4+1)*288));b=tile.getchannel('A').point(lambda x:255 if x>16 else 0).getbbox()
   assert min(b[0],b[1],576-b[2],288-b[3])>=8, (i,b)
   hashes.append(hashlib.sha256(tile.tobytes()).hexdigest())
  assert len(set(hashes))==8
 results.append({'file':f,'width':im.width,'height':im.height,'alpha':a.getextrema()})
print(json.dumps(results))
`],{encoding:'utf8'}));
const stage=fs.readFileSync('src/components/kilo/pixiStage.ts','utf8');
for(const f of files){assert(stage.includes('/'+f),`preload ${f}`);if(process.argv.includes('--dist'))assert.equal(createHash('sha256').update(fs.readFileSync('dist/'+f)).digest('hex'),createHash('sha256').update(fs.readFileSync('public/'+f)).digest('hex'),f);}
fs.writeFileSync('art/kilo-v56/asset-verification.json',JSON.stringify({method:'Decoded runtime alpha/dimensions, eight distinct frame hashes, alpha padding and preload bindings.',dist:process.argv.includes('--dist'),bytes:files.reduce((n,f)=>n+fs.statSync('public/'+f).size,0),pixels},null,2)+'\n');
console.log('PASS four feature illustrations + eight stop keys: alpha, padding, dimensions, preloads'+(process.argv.includes('--dist')?' and built bytes.':'.'));
