import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'smol-toml';
import { installNotify,uninstallNotify,installHook,uninstallHook,hookDefinition,launchAgent } from '../lib/integration.mjs';
import { forwardNotify } from '../lib/ingress.mjs';

const wrapper=['/fake/node','/fake/alert.mjs','notify','--home','/fake/state'];
test('既存notifyの複数行、引数、コメント、他設定を保存して復元',()=>{
  const original='# before\nnotify = [\n  "/fake/client",\n  "turn-ended", "literal $(never)"\n] # note\nmodel="fake-model"\n[features]\nhooks=true\n';
  const installed=installNotify(original,wrapper);
  assert.deepEqual(installed.previousNotify,['/fake/client','turn-ended','literal $(never)']);
  assert.deepEqual(parse(installed.text).notify,wrapper);
  assert.equal(uninstallNotify(installed.text+'\n[custom]\na=1\n',installed),original+'\n[custom]\na=1\n');
});
test('notifyがない設定、導入後に別notifyへ変更した場合も他設定を維持',()=>{
  const original='[features]\nhooks=true\n';const i=installNotify(original,wrapper);
  assert.equal(uninstallNotify(i.text,i),original);
  const changed='notify=["another-notifier"]\n'+original;assert.equal(uninstallNotify(changed,i),changed);
});
test('シェルではなく引数配列で元notifyへ全引数をそのまま渡す',()=>{
  let capture;
  forwardNotify(['/fake/client','turn-ended','a b'],['{"text":"$(never)"}'],(...args)=>{capture=args;return {on(){},unref(){}};});
  assert.deepEqual(capture[1],['turn-ended','a b','{"text":"$(never)"}']);assert.equal(capture[2].shell,false);
});
test('既存hookを保持、二重追加なし、追加分だけ解除',()=>{
  const original={description:'existing',hooks:{PermissionRequest:[{matcher:'Bash',hooks:[{type:'command',command:'old'}]}],Stop:[]}};
  const handler=hookDefinition('/fake/node',"/fake/a'b/alert.mjs",'/fake/home');
  assert.equal(handler.async,true);assert.ok(!('decision' in handler));assert.ok(handler.command.includes("'\\''"));
  const once=installHook(original,handler),twice=installHook(once,handler);
  assert.deepEqual(once,twice);assert.deepEqual(uninstallHook(twice,handler),original);
});
test('変更された自分のhook/notifyを黙って上書きしない',()=>{
  const i=installNotify('',wrapper);assert.throws(()=>uninstallNotify(i.text.replace('"notify"','"notify", "changed"'),i));
  const h=hookDefinition('node','script','home');const doc=installHook({},h);doc.hooks.PermissionRequest[0].hooks[0].timeout=6;
  assert.throws(()=>uninstallHook(doc,h));
});
test('LaunchAgentのパスをXMLエスケープ、ログは捨てる',()=>{
  const p=launchAgent('/a&b/node','/a<script','/fake/private','fake.label');
  assert.ok(p.includes('/a&amp;b/node'));assert.ok(p.includes('/a&lt;script'));assert.ok(p.includes('/dev/null'));
});
