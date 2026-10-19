/** Read texture dimensions without decoding unused preload/optional atlases.
 * Visible sprites are still rasterized from the exact original file pixels. */
import fs from 'node:fs';
export function imageMetadata(url){
 const file='public'+url,fd=fs.openSync(file,'r'),buffer=Buffer.alloc(65536);let length;
 try{length=fs.readSync(fd,buffer,0,buffer.length,0);}finally{fs.closeSync(fd);}
 const b=buffer.subarray(0,length);let width,height;
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  const kind=b.toString('ascii',12,16);
  if(kind==='VP8X'){width=b.readUIntLE(24,3)+1;height=b.readUIntLE(27,3)+1;}
  else if(kind==='VP8L'){const bits=b.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  else if(kind==='VP8 '){width=b.readUInt16LE(26)&0x3fff;height=b.readUInt16LE(28)&0x3fff;}
 }
 else if(b[0]===0xff&&b[1]===0xd8){let offset=2;while(offset+9<b.length){if(b[offset++]!==0xff)continue;const marker=b[offset++];if(marker===0xd8||marker===0xd9)continue;const size=b.readUInt16BE(offset);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=b.readUInt16BE(offset+3);width=b.readUInt16BE(offset+5);break;}offset+=size;}}
 else if(url.endsWith('.svg')){const text=b.toString('utf8'),tag=text.match(/<svg\b[^>]*>/i)?.[0]??'';width=parseFloat(tag.match(/\bwidth=["']([^"']+)/)?.[1]??'');height=parseFloat(tag.match(/\bheight=["']([^"']+)/)?.[1]??'');if(!(width>0&&height>0)){const box=tag.match(/\bviewBox=["']([^"']+)/)?.[1].trim().split(/[\s,]+/).map(Number);if(box?.length===4){width=box[2];height=box[3];}}}
 if(!(width>0&&height>0))throw Error('Unsupported or invalid offline image header: '+file);
 return{source:{url,width,height},width,height};
}
