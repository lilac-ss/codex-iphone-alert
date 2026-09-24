import path from 'node:path';
import { openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { readJson, atomicJson, privateDir, queued } from './store.mjs';
import { initialState, step } from './engine.mjs';
import { macState } from './mac.mjs';
import { acknowledged } from './events.mjs';
import { createSender } from './push.mjs';

export async function cycle(home, { now = Date.now, probe = macState, send = createSender() } = {}) {
  const entries = queued(home);
  const settings = readJson(path.join(home, 'settings.json'));
  const control = readJson(path.join(home, 'control.json'), { stopAt: 0 });
  const device = readJson(path.join(home, 'device.json'), null);
  const state = readJson(path.join(home, 'engine.json'), initialState());
  const os = await probe();
  const result = step(state, { now: now(), events: entries.map(e => e.event), os, stopAt: control.stopAt, enabled: Boolean(device && !device.disabled) });
  // Persist the attempted slot BEFORE networking: crash/restart can't burst.
  atomicJson(path.join(home, 'engine.json'), result.state);
  for (const entry of entries) try { unlinkSync(entry.file); } catch {}
  let outcome = null;
  const test = readJson(path.join(home, 'test-request.json'), null);
  if (test) try { unlinkSync(path.join(home, 'test-request.json')); } catch {}
  let freshControl = readJson(path.join(home, 'control.json'), { stopAt: 0 });
  if (freshControl.stopAt === control.stopAt && (result.batch || test) && device && !device.disabled) {
    const latestOs = await probe();
    freshControl = readJson(path.join(home, 'control.json'), { stopAt: 0 });
    const cancelled = freshControl.stopAt !== control.stopAt;
    // A manual test is one visible push, including while Codex is foreground.
    if (!cancelled && test && test.at > freshControl.stopAt && now() - test.at < 60_000) {
      outcome = await send(device.subscription, settings.vapid, { version: 1, events: [{ kind: 'complete', at: test.at }] }, 60);
    } else if (!cancelled && result.batch && !acknowledged(latestOs)) {
      const remaining = Math.floor((Math.min(...result.state.pending.map(e => e.at + 30 * 60_000)) - now()) / 1000);
      if (remaining > 0) outcome = await send(device.subscription, settings.vapid, result.batch.payload, Math.min(result.batch.ttl, remaining));
    }
  }
  if (outcome?.invalid) {
    const current = readJson(path.join(home, 'device.json'), null);
    if (current?.importId === device.importId) atomicJson(path.join(home, 'device.json'), { ...current, disabled: true });
  }
  const before = readJson(path.join(home, 'status.json'), {});
  atomicJson(path.join(home, 'status.json'), {
    pid: process.pid, updatedAt: now(), pending: result.state.pending.length, attempts: result.state.attempts,
    accepted: result.state.accepted, os, stopAt: control.stopAt,
    lastSend: outcome ? { at: now(), ok: outcome.ok, code: outcome.code } : before.lastSend ?? null
  });
}
export async function runDaemon(home) {
  privateDir(home);
  const lock = path.join(home, 'daemon-lock.json');
  const token = randomUUID();
  try {
    const old = readJson(lock, null);
    if (old) {
      let alive = true; try { process.kill(old.pid, 0); } catch { alive = false; }
      if (alive) throw new Error('daemon_running');
      unlinkSync(lock);
    }
    const fd = openSync(lock, 'wx', 0o600);
    writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); closeSync(fd);
  } catch { throw new Error('daemon_running'); }
  let running = true;
  process.on('SIGTERM', () => { running = false; });
  process.on('SIGINT', () => { running = false; });
  const send = createSender();
  try {
    while (running) {
      try { await cycle(home, { send }); }
      catch { atomicJson(path.join(home, 'health.json'), { at: Date.now(), code: 'cycle_failed' }); }
      if (running) await new Promise(r => setTimeout(r, 1000));
    }
  } finally { if (readJson(lock, null)?.token === token) unlinkSync(lock); }
}
