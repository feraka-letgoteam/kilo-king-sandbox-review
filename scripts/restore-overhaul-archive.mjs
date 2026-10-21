import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Private source archives are split only for transport. Every byte is retained.
const folder=path.resolve(process.argv[2]??'art/kilo-overhaul-v1/source-parts');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const output=path.resolve(process.argv[3]??path.join(folder,'..',manifest.archive));
const temporary=output+'.partial';
const full=crypto.createHash('sha256');let bytes=0;
const target=fs.openSync(temporary,'w');
try{
  for(const part of manifest.parts){
    const data=fs.readFileSync(path.join(folder,part.file));
    if(data.length!==part.bytes||crypto.createHash('sha256').update(data).digest('hex')!==part.sha256)throw Error('Archive part failed verification: '+part.file);
    let offset=0;while(offset<data.length)offset+=fs.writeSync(target,data,offset,data.length-offset);
    full.update(data);bytes+=data.length;
  }
  if(bytes!==manifest.bytes||full.digest('hex')!==manifest.sha256)throw Error('Complete archive failed verification');
  fs.fsyncSync(target);fs.closeSync(target);fs.renameSync(temporary,output);
  console.log('Verified archive: '+output);
}catch(error){try{fs.closeSync(target);}catch{}fs.rmSync(temporary,{force:true});throw error;}
