import { spawn } from 'node:child_process';
import path from 'node:path';
import { readJson, enqueue } from './store.mjs';
import { normalizeEvent } from './events.mjs';
import { macState } from './mac.mjs';

export function forwardNotify(command, extraArgs, spawnProcess = spawn) {
  if (!Array.isArray(command) || !command.length || command.some(v => typeof v !== 'string')) return;
  try {
    const child = spawnProcess(command[0], [...command.slice(1), ...extraArgs], { detached: true, stdio: 'ignore', shell: false });
    child.on('error', () => {}); child.unref();
  } catch {}
}
export async function receive(home, source, raw, extraArgs = [], { probe = macState, now = Date.now } = {}) {
  if (source === 'notify') {
    try { forwardNotify(readJson(path.join(home, 'integration.json')).previousNotify, extraArgs); } catch {}
  }
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2 * 1024 * 1024) return;
    const at = now();
    const settings = readJson(path.join(home, 'settings.json'));
    const value = JSON.parse(raw);
    const observed = await probe();
    const event = normalizeEvent(value, source, at, settings.dedupSalt, observed);
    if (event) enqueue(home, event);
  } catch {} // Hooks and notify never emit input or influence approval.
}
export async function readStdin(input = process.stdin) {
  let size = 0, chunks = [];
  for await (const chunk of input) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) return '';
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
