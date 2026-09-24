import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
function worker() {
  const handlers={},shown=[];
  const context=vm.createContext({self:{addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:(title,options)=>{shown.push({title,options});return Promise.resolve();}}}});
  vm.runInContext(readFileSync(new URL('../web/sw.js',import.meta.url),'utf8'),context);
  return {handlers,shown};
}
test('全てのpushを可視通知にし、リモート本文やURLを表示しない',async()=>{
  const {handlers,shown}=worker();
  for(const json of [{version:1,events:[{kind:'complete',at:1_800_000_000_000},{kind:'permission',at:1_800_000_000_000}],body:'FICTITIOUS-SECRET',url:'https://evil.test'},null,{version:1,events:[{kind:'custom secret',at:1}]}]) {
    let done;handlers.push({data:{json:()=>json},waitUntil:p=>done=p});await done;
  }
  assert.equal(shown.length,3);assert.ok(shown[0].options.body.includes('Codexの応答が完了しました'));assert.ok(shown[0].options.body.includes('Codexで承認要求が発生しました'));
  assert.ok(!JSON.stringify(shown).includes('SECRET'));assert.ok(!JSON.stringify(shown).includes('evil.test'));
  assert.equal(shown[0].options.renotify,true);
});
