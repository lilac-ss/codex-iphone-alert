import { constants, lstatSync, mkdirSync, chmodSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const defaultHome = () => path.join(homedir(), 'Library/Application Support/codex-iphone-alert');
export function privateDir(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid()) throw new Error('unsafe_directory');
  chmodSync(dir, 0o700);
}
export function assertOutsideRepo(dir, repo) {
  const resolved = realpathSync(dir), root = realpathSync(repo);
  if (resolved === root || resolved.startsWith(root + path.sep)) throw new Error('state_in_repository');
  for (let dir = resolved; dir !== path.dirname(dir); dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, '.git'))) throw new Error('state_in_repository');
  }
}
export function readText(file, fallback, max = 2 * 1024 * 1024) {
  let fd;
  try {
    const st = lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.size > max || st.uid !== process.getuid()) throw new Error('unsafe_file');
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    return readFileSync(fd, 'utf8');
  } catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return fallback; throw e; }
  finally { if (fd !== undefined) closeSync(fd); }
}
export function readJson(file, fallback) {
  const text = readText(file, fallback === undefined ? undefined : '');
  return text === '' ? structuredClone(fallback) : JSON.parse(text);
}
export function atomicText(file, text) {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const parent = lstatSync(dir);
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid()) throw new Error('unsafe_directory');
  // Never follow a target symlink, even though rename itself would replace it.
  try { if (lstatSync(file).isSymbolicLink()) throw new Error('unsafe_file'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = path.join(dir, '.' + randomUUID() + '.tmp');
  try {
    writeFileSync(tmp, text, { mode: 0o600, flag: 'wx' });
    renameSync(tmp, file);
  } finally { try { unlinkSync(tmp); } catch {} }
}
export const atomicJson = (file, data) => atomicText(file, JSON.stringify(data) + '\n');
export function enqueue(home, event) {
  const dir = path.join(home, 'queue'); privateDir(dir);
  if (!/^[a-f0-9]{64}$/.test(event.id)) throw new Error('invalid_event');
  // Atomic rename of a fully written, minimal event. Duplicates are also
  // checked against durable tombstones by the single daemon writer.
  const file = path.join(dir, event.id + '.json');
  try { readText(file); return; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  atomicJson(file, event);
}
export function queued(home) {
  const dir = path.join(home, 'queue'); privateDir(dir);
  return readdirSync(dir).filter(n => /^[a-f0-9]{64}\.json$/.test(n)).sort().slice(0, 1000)
    .map(name => ({ file: path.join(dir, name), event: (() => { try { return readJson(path.join(dir, name)); } catch { return null; } })() }));
}
