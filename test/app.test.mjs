import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('既に開いた登録ページでも公開鍵付きfragmentへの移動を取り込む',async()=>{
  const nodes=new Map(),handlers={},storage=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:true,addEventListener(){}});return nodes.get(id);};
  const location={href:'https://example.test/app/',hash:''};
  const reg={pushManager:{getSubscription:async()=>null}};
  const context=vm.createContext({document:{querySelector:node},window:{PushManager:{},Notification:{},addEventListener:(name,fn)=>handlers[name]=fn},
    navigator:{serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg)}},location,
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Notification:{permission:'default'},
    matchMedia:()=>({matches:true}),URL,URLSearchParams,Uint8Array,atob,history:{replaceState:()=>{location.hash='';}},setTimeout});
  vm.runInContext(readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),context);
  await new Promise(r=>setImmediate(r));
  assert.equal(node('#subscribe').disabled,true);
  const fake=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,3)]).toString('base64url');
  location.hash='#key='+fake;await handlers.hashchange();
  assert.equal(node('#key').value,fake);assert.equal(node('#subscribe').disabled,false);assert.equal(location.hash,'');
});
