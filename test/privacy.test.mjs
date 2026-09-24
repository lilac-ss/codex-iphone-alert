import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync,symlinkSync,readFileSync,readdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeEvent } from '../lib/events.mjs';
import { validateSubscription,validateRegistration } from '../lib/subscription.mjs';
import { atomicJson,privateDir,readJson,enqueue,queued } from '../lib/store.mjs';
import { receive } from '../lib/ingress.mjs';
import { build,PUBLIC_FILES } from '../scripts/build.mjs';
import { temporary,fakeSubscription,epoch } from './helpers.mjs';

test('通知入力から本文・コマンド・パス・生の識別子を保存しない',()=>{
  const secret='FICTITIOUS-SENSITIVE-CONTENT';
  const a=normalizeEvent({type:'agent-turn-complete','thread-id':'fake-thread','turn-id':'fake-turn',cwd:secret,'last-assistant-message':secret},'notify',epoch,'fake-salt',{});
  assert.ok(a);assert.ok(!JSON.stringify(a).includes(secret));assert.ok(!JSON.stringify(a).includes('fake-thread'));
  const b=normalizeEvent({hook_event_name:'PermissionRequest',session_id:'fake-session',turn_id:'fake-turn',tool_name:'Bash',tool_input:{command:secret}},'hook',epoch,'fake-salt',{});
  assert.ok(b);assert.ok(!JSON.stringify(b).includes(secret));
  assert.equal(normalizeEvent({hook_event_name:'UserPromptSubmit'},'hook',epoch,'fake-salt',{}),null);
});
test('識別子不足を捨て、PermissionRequestは同ターン・同ツールを重複除去',()=>{
  const p={hook_event_name:'PermissionRequest',session_id:'fake-session',turn_id:'fake-turn',tool_name:'Bash'};
  const a=normalizeEvent(p,'hook',epoch,'salt',{}),b=normalizeEvent({...p,tool_input:{command:'new fake command'}},'hook',epoch+1000,'salt',{});
  assert.equal(a.id,b.id);assert.equal(normalizeEvent({type:'agent-turn-complete'},'notify',epoch,'salt',{}),null);
});
test('購読はAppleの正規サブドメイン/HTTPS/鍵形式だけを許可',()=>{
  const s=fakeSubscription();assert.deepEqual(validateSubscription(s),s);
  for(const endpoint of ['http://web.push.apple.com/a','https://push.apple.com.evil.test/a','https://evil.test/a','https://127.0.0.1/a','https://web.push.apple.com:444/a','https://user@web.push.apple.com/a','https://web.push.apple.com/a#x','https://push.apple.com/a']) {
    assert.throws(()=>validateSubscription({...s,endpoint}));
  }
  assert.throws(()=>validateSubscription({...s,keys:{...s.keys,auth:'not-a-key'}}));
  assert.throws(()=>validateSubscription({...s,expirationTime:epoch-1},epoch));
});
test('別の公開鍵・別サイトの登録ファイルを拒否し、余分な項目を捨てる',()=>{
  const settings={site:'https://example.test/app/',vapid:{publicKey:'fake-public-key'}};
  const data={version:1,site:settings.site,applicationServerKey:settings.vapid.publicKey,subscription:{...fakeSubscription(),extra:'private'}};
  assert.ok(!('extra' in validateRegistration(data,settings)));
  assert.throws(()=>validateRegistration({...data,site:'https://evil.test/'},settings));
  assert.throws(()=>validateRegistration({...data,applicationServerKey:'wrong'},settings));
});
test('所有者権限、symlink拒否、入力破損でもhookを失敗させない',async t=>{
  const home=temporary(t);privateDir(home);atomicJson(path.join(home,'settings.json'),{dedupSalt:'fake-salt'});
  const data={hook_event_name:'PermissionRequest',session_id:'fake-session',turn_id:'fake-turn',tool_name:'Bash',tool_input:{command:'FICTITIOUS-SECRET'}};
  await receive(home,'hook',JSON.stringify(data),[],{now:()=>epoch,probe:async()=>({locked:true,codexFront:true})});
  const records=queued(home);assert.equal(records.length,1);assert.ok(!readFileSync(records[0].file,'utf8').includes('FICTITIOUS'));
  assert.equal(statSync(home).mode&0o777,0o700);assert.equal(statSync(records[0].file).mode&0o777,0o600);
  symlinkSync(records[0].file,path.join(home,'bad.json'));assert.throws(()=>readJson(path.join(home,'bad.json')));
  await receive(home,'hook','invalid-json');
});
test('ビルドは静的10ファイルだけ。秘密情報や外部JSをコピーしない',t=>{
  const out=path.join(temporary(t),'dist');build(out);
  assert.deepEqual(readdirSync(out).sort(),[...PUBLIC_FILES].sort());
  const html=readFileSync(path.join(out,'index.html'),'utf8');assert.ok(!/<script[^>]+src="https?:/.test(html));
  for(const file of PUBLIC_FILES.filter(f=>!f.endsWith('.png'))) {
    const text=readFileSync(path.join(out,file),'utf8');
    assert.ok(!/"privateKey"|"endpoint"\s*:|"auth"\s*:|BEGIN .*PRIVATE KEY/.test(text),file);
  }
  assert.ok(!readFileSync(path.join(out,'sw.js'),'utf8').includes('__BUILD_HASH__'));
});
