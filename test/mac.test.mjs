import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,copyFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { temporary } from './helpers.mjs';
test('Application Supportのように空白を含む導入先でも状態取得する',async t=>{
  const root=path.join(temporary(t),'Application Support');
  mkdirSync(path.join(root,'lib'),{recursive:true});mkdirSync(path.join(root,'build'));
  copyFileSync(new URL('../lib/mac.mjs',import.meta.url),path.join(root,'lib/mac.mjs'));
  writeFileSync(path.join(root,'build/mac-state'),'#!'+process.execPath+'\nconsole.log(JSON.stringify({locked:false,codexFront:true}));\n',{mode:0o700});
  const {macState}=await import(pathToFileURL(path.join(root,'lib/mac.mjs')));
  assert.deepEqual(await macState(),{locked:false,codexFront:true});
  assert.deepEqual(await macState('/nonexistent-fake-helper'),{locked:null,codexFront:null});
});
