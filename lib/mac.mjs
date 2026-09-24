import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export async function macState(binary = new URL('../build/mac-state', import.meta.url).pathname) {
  try {
    const { stdout } = await exec(binary, [], { timeout: 1000, maxBuffer: 1024, encoding: 'utf8' });
    const value = JSON.parse(stdout);
    const bool = v => v === true || v === false ? v : null;
    return { locked: bool(value.locked), codexFront: bool(value.codexFront) };
  } catch { return { locked: null, codexFront: null }; }
}
