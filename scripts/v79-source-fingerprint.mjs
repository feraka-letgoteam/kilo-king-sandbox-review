import fs from 'node:fs';
import crypto from 'node:crypto';
/** Every runtime source and public asset, including replaced legacy URLs. */
export function sourceFingerprint(){
 const files=[];
 const scan=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())scan(f);else if(e.isFile())files.push(f);}};
 scan('src');scan('public');files.sort();
 return crypto.createHash('sha256').update(files.map(f=>f+'\0'+crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join('\n')).digest('hex');
}
