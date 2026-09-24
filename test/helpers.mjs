import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createECDH } from 'node:crypto';
export function temporary(t) { const dir = mkdtempSync(path.join(tmpdir(),'codex-alert-test-')); t.after(()=>rmSync(dir,{recursive:true,force:true})); return dir; }
export function fakeSubscription() {
  const curve=createECDH('prime256v1'); curve.generateKeys();
  return { endpoint:'https://web.push.apple.com/fake-test-only',expirationTime:null,keys:{p256dh:curve.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')} };
}
export const epoch = 1_800_000_000_000;
export const event = (id=1,at=epoch,kind='complete',observed={locked:false,codexFront:false}) => ({id:id.toString(16).padStart(64,'0'),at,kind,observed});
