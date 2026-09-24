import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { readJson,atomicJson,enqueue,queued } from '../lib/store.mjs';
import { cycle } from '../lib/daemon.mjs';
import { createSender } from '../lib/push.mjs';
import webpush from 'web-push';
import { temporary,fakeSubscription,event,epoch } from './helpers.mjs';
const os=async()=>({locked:false,codexFront:false});
function prepare(t) {
  const home=temporary(t);
  atomicJson(path.join(home,'settings.json'),{vapid:{...webpush.generateVAPIDKeys(),subject:'https://example.test/app/'}});
  atomicJson(path.join(home,'device.json'),{subscription:fakeSubscription(),importId:'fake-import'});
  return home;
}
test('障害は次の1分まで再試行しない。HTTP本文を状態に含めない',async t=>{
  const home=prepare(t);enqueue(home,event());let calls=0;
  const send=async()=>{calls++;return {ok:false,code:503,body:'FICTITIOUS-SECRET'};};
  await cycle(home,{now:()=>epoch,probe:os,send});
  await cycle(home,{now:()=>epoch+1000,probe:os,send});assert.equal(calls,1);
  await cycle(home,{now:()=>epoch+60_000,probe:os,send});assert.equal(calls,2);
  assert.ok(!JSON.stringify(readJson(path.join(home,'status.json'))).includes('FICTITIOUS'));assert.equal(queued(home).length,0);
});
test('無効購読は停止し、再登録後の端末を古い失敗で無効化しない',async t=>{
  const home=prepare(t);enqueue(home,event());
  await cycle(home,{now:()=>epoch,probe:os,send:async()=>({ok:false,code:410,invalid:true})});
  assert.equal(readJson(path.join(home,'device.json')).disabled,true);
  const d=readJson(path.join(home,'device.json'));atomicJson(path.join(home,'device.json'),{...d,disabled:false});
  await cycle(home,{now:()=>epoch+60_000,probe:os,send:async()=>{atomicJson(path.join(home,'device.json'),{...d,importId:'new-fake-import',disabled:false});return {ok:false,code:410,invalid:true};}});
  assert.equal(readJson(path.join(home,'device.json')).disabled,false);
});
test('送信前の前面化と停止要求で追加送信しない',async t=>{
  const home=prepare(t);enqueue(home,event());let n=0,calls=0;
  await cycle(home,{now:()=>epoch,probe:async()=>({locked:false,codexFront:++n>1}),send:async()=>{calls++;}});
  assert.equal(calls,0);
  atomicJson(path.join(home,'control.json'),{stopAt:epoch+1});
  await cycle(home,{now:()=>epoch+60_000,probe:os,send:async()=>{calls++;}});
  assert.equal(calls,0);assert.equal(readJson(path.join(home,'engine.json')).pending.length,0);
});
test('手動テストは前面でも1回、期限切れ依頼は送信しない',async t=>{
  const home=prepare(t);atomicJson(path.join(home,'test-request.json'),{at:epoch});let calls=0;
  const opts={now:()=>epoch,probe:async()=>({locked:false,codexFront:true}),send:async()=>{calls++;return {ok:true,code:201};}};
  await cycle(home,opts);await cycle(home,opts);assert.equal(calls,1);
  atomicJson(path.join(home,'test-request.json'),{at:epoch-61_000});await cycle(home,opts);assert.equal(calls,1);
});
test('暗号化をライブラリに委ね、1時間はJWT再利用、リダイレクトに従わない',async()=>{
  const captured=[];let time=Date.now(),code=201;
  const request=(url,options,callback)=>{captured.push({url,options});const req=new EventEmitter();req.end=body=>{assert.ok(Buffer.isBuffer(body));queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=code;res.resume=()=>queueMicrotask(()=>res.emit('end'));callback(res);});};req.destroy=()=>{};return req;};
  const send=createSender({request,now:()=>time});const s=fakeSubscription(),v={...webpush.generateVAPIDKeys(),subject:'https://example.test/'};
  assert.equal((await send(s,v,{version:1,events:[{kind:'complete',at:epoch}]},60)).ok,true);
  time+=60_000;code=302;assert.equal((await send(s,v,{version:1,events:[]},60)).ok,false);
  assert.equal(captured.length,2);assert.equal(captured[0].options.headers.Authorization,captured[1].options.headers.Authorization);
  assert.equal(captured[0].options.headers.TTL,60);assert.equal(captured[0].options.headers['Content-Encoding'],'aes128gcm');
});
test('不正宛先は送信せずネットワークエラーの内容を外へ出さない',async()=>{
  let calls=0;const sender=createSender({request:()=>{calls++;throw new Error('FICTITIOUS-SECRET');}});
  assert.equal((await sender({...fakeSubscription(),endpoint:'https://evil.test/a'}, {},{},60)).ok,false);assert.equal(calls,0);
});
