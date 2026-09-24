import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState,step } from '../lib/engine.mjs';
import { INTERVAL,LIFETIME } from '../lib/constants.mjs';
import { epoch,event } from './helpers.mjs';

test('初回、1分周期、30分ちょうどを除く30回',()=>{
  let s=initialState(),sent=[];
  for(let n=0;n<=1800;n++) {
    const r=step(s,{now:epoch+n*1000,events:n===0?[event()]:[]});s=r.state;
    if(r.batch) sent.push(n);
  }
  assert.deepEqual(sent,Array.from({length:30},(_,i)=>i*60));assert.equal(s.pending.length,0);
});
test('重複で期限を延長せず、複数イベントを最大2種類の本文へ集約',()=>{
  let r=step(initialState(),{now:epoch,events:[event(),event(),event(2,epoch,'permission')]});
  assert.equal(r.state.pending.length,2);assert.equal(r.batch.payload.events.length,2);
  r=step(r.state,{now:epoch+INTERVAL,events:[event(1,epoch+INTERVAL),event(3,epoch+INTERVAL)]});
  assert.equal(r.state.pending[0].at,epoch);assert.equal(r.state.pending.length,3);
  r=step(r.state,{now:epoch+LIFETIME});
  assert.deepEqual(r.state.pending.map(e=>e.id),[event(3).id]);
});
test('新規イベントも1分内の送信をまとめ、既存期限を延長しない',()=>{
  const first=step(initialState(),{now:epoch,events:[event()]});
  const second=step(first.state,{now:epoch+1000,events:[event(2,epoch+1000)]});
  assert.equal(second.batch,null);assert.equal(second.state.pending[0].at,epoch);
  assert.equal(step(second.state,{now:epoch+INTERVAL}).batch.payload.events[0].at,epoch+1000);
});
test('前面かつロック解除だけが全イベントを停止する',()=>{
  const first=step(initialState(),{now:epoch,events:[event(),event(2,epoch,'permission')]});
  for(const os of [{locked:true,codexFront:true},{locked:null,codexFront:true},{locked:false,codexFront:null}]) {
    assert.equal(step(first.state,{now:epoch+1000,os}).state.pending.length,2);
  }
  const stopped=step(first.state,{now:epoch+1000,os:{locked:false,codexFront:true}});
  assert.equal(stopped.state.pending.length,0);
  assert.equal(step(stopped.state,{now:epoch+INTERVAL,events:[event(1,epoch+INTERVAL)]}).batch,null);
});
test('発生時に確認済みなら後で他アプリへ移っても通知しない',()=>{
  const r=step(initialState(),{now:epoch,events:[event(1,epoch,'complete',{locked:false,codexFront:true})]});
  assert.equal(r.batch,null);assert.equal(r.state.pending.length,0);
});
test('発生時ロック中・状態不明は確認済みにしない',()=>{
  for(const observed of [{locked:true,codexFront:true},{locked:null,codexFront:true}]) {
    assert.ok(step(initialState(),{now:epoch,events:[event(1,epoch,'complete',observed)]}).batch);
  }
});
test('スリープ復帰は過去分を連続送信せず、再起動も期限を引き継ぐ',()=>{
  let r=step(initialState(),{now:epoch,events:[event()]});
  r=step(JSON.parse(JSON.stringify(r.state)),{now:epoch+10*INTERVAL});
  assert.ok(r.batch);assert.equal(step(r.state,{now:epoch+10*INTERVAL+1}).batch,null);
  assert.equal(step(r.state,{now:epoch+LIFETIME}).batch,null);
});
test('手動停止は停止時刻以前を廃棄し、新しいイベントだけを受け付ける',()=>{
  const r=step(initialState(),{now:epoch+1000,events:[event(),event(2,epoch+1000)],stopAt:epoch});
  assert.deepEqual(r.state.pending.map(e=>e.id),[event(2).id]);
});
test('時計の巻き戻りは保留を廃棄、未登録中はネットワーク送信しない',()=>{
  const first=step(initialState(),{now:epoch,events:[event()]});
  assert.equal(step(first.state,{now:epoch-1000}).state.pending.length,0);
  const r=step(initialState(),{now:epoch,events:[event()],enabled:false});
  assert.equal(r.batch,null);assert.equal(r.state.attempts,0);
});
test('期限直前のTTLは期限を超えず、期限後・不正イベントは捨てる',()=>{
  const r=step(initialState(),{now:epoch+LIFETIME-10_000,events:[event()]});assert.equal(r.batch.ttl,10);
  assert.equal(step(initialState(),{now:epoch+LIFETIME,events:[event()]}).batch,null);
  assert.equal(step(initialState(),{now:epoch,events:[null,{...event(),kind:'custom-text'},event(1,epoch+999999)]}).batch,null);
});
