import { mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
export const PUBLIC_FILES = ['index.html','style.css','app.js','sw.js','manifest.webmanifest','icon.svg','icon-180.png','icon-192.png','icon-512.png','.nojekyll'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function build(out = path.join(root, 'dist')) {
  // Fixed output directory prevents accidentally serving the repo or state.
  if (path.basename(out) !== 'dist' || (out !== path.join(root,'dist') && !out.startsWith('/private/tmp/') && !out.startsWith('/tmp/') && !out.startsWith(tmpdir() + path.sep))) throw new Error('invalid_build_path');
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  const source = PUBLIC_FILES.filter(n => !n.endsWith('.png') && n !== '.nojekyll');
  const digest = createHash('sha256');
  for (const name of source) { const content = readFileSync(path.join(root,'web',name)); digest.update(content); copyFileSync(path.join(root,'web',name),path.join(out,name)); }
  writeFileSync(path.join(out,'sw.js'), readFileSync(path.join(out,'sw.js'),'utf8').replace('__BUILD_HASH__',digest.digest('hex').slice(0,16)));
  for (const size of [180,192,512]) writeFileSync(path.join(out,`icon-${size}.png`), icon(size));
  writeFileSync(path.join(out,'.nojekyll'),'');
  return PUBLIC_FILES;
}
// A small geometric app icon, generated without image dependencies.
function crc32(data) { let c=0xffffffff; for(const b of data) { c^=b; for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
function chunk(type,data) { const t=Buffer.from(type), len=Buffer.alloc(4), crc=Buffer.alloc(4); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([len,t,data,crc]); }
function icon(size) {
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const a=x/size*192,b=y/size*192;
    const bell=(a>=59&&a<=133&&b>=85&&b<=124)||((a-96)**2+(b-85)**2<37**2&&b<=85)||(b>=121&&b<=132&&a>50&&a<142)||((a-96)**2+(b-141)**2<14**2&&b>=143);
    const dot=(a-138)**2+(b-54)**2<16**2;
    const color=dot?[180,237,139]:bell?[243,245,240]:[19,41,36];
    raw.set([...color,255],y*(size*4+1)+1+x*4);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { build(); console.log('dist/: 公開用ファイル10件を生成しました。'); }
