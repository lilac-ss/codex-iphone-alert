import { readdirSync,readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build,PUBLIC_FILES } from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const dir of ['bin','lib','scripts','test','web']) for(const name of readdirSync(path.join(root,dir))) {
  if (!/\.(mjs|js)$/.test(name)) continue;
  const result=spawnSync(process.execPath,['--check',path.join(root,dir,name)],{stdio:'inherit'});if(result.status!==0) process.exit(1);
}
build();assert.deepEqual(readdirSync(path.join(root,'dist')).sort(),[...PUBLIC_FILES].sort());
const manifest=JSON.parse(readFileSync(path.join(root,'dist/manifest.webmanifest'),'utf8'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
const forbidden=/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----|"endpoint"\s*:\s*"https:\/\/(?![^\"]*fake)|"privateKey"\s*:\s*"[A-Za-z0-9_-]{43}"/;
for(const name of PUBLIC_FILES.filter(n=>!n.endsWith('.png'))) assert.ok(!forbidden.test(readFileSync(path.join(root,'dist',name),'utf8')),name);
console.log('構文・公開ファイル一覧・PWA相対パス・秘密情報パターン: OK');
