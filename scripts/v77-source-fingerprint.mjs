import fs from 'node:fs';
import crypto from 'node:crypto';
/** Covers every runtime source and newly authored v77 asset; no Git needed. */
export function sourceFingerprint(){
 const files=[];
 const scan=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())scan(file);else if(entry.isFile())files.push(file);}};
 scan('src');scan('public/kilo-v77');files.sort();
 return crypto.createHash('sha256').update(files.map(file=>file+'\0'+crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')).join('\n')).digest('hex');
}
