import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync, existsSync, chmodSync, readdirSync, lstatSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'smol-toml';
import { readText, readJson, atomicText, atomicJson, privateDir, assertOutsideRepo } from './store.mjs';
import { installNotify, uninstallNotify, hookDefinition, installHook, uninstallHook, launchAgent } from './integration.mjs';
import { LABEL } from './constants.mjs';

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function secureTree(dir) {
  chmodSync(dir, 0o700);
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry), st = lstatSync(file);
    if (st.isDirectory()) secureTree(file);
    else if (!st.isSymbolicLink()) chmodSync(file, path.basename(file) === 'mac-state' ? 0o700 : 0o600);
  }
}
export function install(home, { codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex'), agents = path.join(homedir(), 'Library/LaunchAgents'), activate = true, root = sourceRoot } = {}) {
  if (activate && process.platform !== 'darwin') throw new Error('mac_only');
  privateDir(home); assertOutsideRepo(home, root);
  readJson(path.join(home, 'settings.json'));
  const metaFile = path.join(home, 'integration.json');
  if (existsSync(metaFile)) {
    const meta = readJson(metaFile);
    if (JSON.stringify(parse(readText(meta.configFile)).notify) !== JSON.stringify(meta.wrapper)) throw new Error('integration_modified');
    const hooks = readJson(meta.hooksFile, {});
    if (!hooks.hooks?.PermissionRequest?.some(group => group.hooks?.some(h => JSON.stringify(h) === JSON.stringify(meta.handler))) || !existsSync(meta.plistFile)) throw new Error('installation_incomplete');
    if (activate) {
      try { execFileSync('/bin/launchctl', ['print', `gui/${process.getuid()}/${LABEL}`], { stdio: 'ignore' }); }
      catch { execFileSync('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, meta.plistFile], { stdio: 'ignore' }); }
    }
    return { alreadyInstalled: true, hookTrustRequired: true };
  }
  if (!existsSync(path.join(root, 'build/mac-state'))) throw new Error('native_build_required');
  const runtime = path.join(home, 'runtime');
  privateDir(runtime);
  for (const entry of ['bin','lib','package.json','package-lock.json','node_modules']) cpSync(path.join(root, entry), path.join(runtime, entry), { recursive: true });
  privateDir(path.join(runtime, 'build'));
  cpSync(path.join(root, 'build/mac-state'), path.join(runtime, 'build/mac-state'));
  secureTree(runtime);
  const configFile = path.join(codexHome, 'config.toml'), hooksFile = path.join(codexHome, 'hooks.json');
  const config = readText(configFile, ''), hooksText = readText(hooksFile, '');
  const configData = parse(config);
  if (configData.features?.hooks === false || configData.features?.codex_hooks === false) throw new Error('hooks_disabled');
  const wrapper = [process.execPath, path.join(runtime, 'bin/alert.mjs'), 'notify', '--home', home];
  const notify = installNotify(config, wrapper);
  const handler = hookDefinition(process.execPath, path.join(runtime, 'bin/alert.mjs'), home);
  const hooks = installHook(hooksText ? JSON.parse(hooksText) : {}, handler);
  const plistFile = path.join(agents, LABEL + '.plist');
  if (existsSync(plistFile)) throw new Error('launchagent_exists');
  const backup = path.join(home, 'backup'); privateDir(backup);
  atomicText(path.join(backup, 'config-before.toml'), config);
  atomicText(path.join(backup, 'hooks-before.json'), hooksText);
  const metadata = { version: 1, previousNotify: notify.previousNotify, previousRaw: notify.previousRaw, wrapper,
    handler, configFile, hooksFile, hooksExisted: Boolean(hooksText), plistFile };
  // Recovery metadata precedes personal config changes; partial installation is
  // recoverable with uninstall, without restoring unrelated settings wholesale.
  atomicJson(metaFile, metadata);
  atomicText(configFile, notify.text);
  atomicJson(hooksFile, hooks);
  mkdirSync(agents, { recursive: true });
  atomicText(plistFile, launchAgent(process.execPath, path.join(runtime, 'bin/alert.mjs'), home, LABEL));
  if (activate) execFileSync('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, plistFile], { stdio: 'ignore' });
  return { alreadyInstalled: false, hookTrustRequired: true };
}
export function uninstall(home, { activate = true } = {}) {
  const file = path.join(home, 'integration.json');
  const meta = readJson(file);
  const config = uninstallNotify(readText(meta.configFile), meta);
  const hooks = uninstallHook(readJson(meta.hooksFile, {}), meta.handler);
  // Validate both edits before stopping/removing anything.
  atomicJson(path.join(home, 'control.json'), { stopAt: Date.now() });
  if (activate) {
    try { execFileSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`], { stdio: 'ignore' }); } catch {}
  }
  atomicText(meta.configFile, config);
  if (!meta.hooksExisted && Object.keys(hooks).every(k => k === 'hooks') && !Object.keys(hooks.hooks ?? {}).length) {
    try { unlinkSync(meta.hooksFile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  } else atomicJson(meta.hooksFile, hooks);
  try { unlinkSync(meta.plistFile); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  atomicJson(path.join(home, 'uninstalled.json'), { at: Date.now() });
  unlinkSync(file);
  // Keep private keys and local backups for recovery. Explicit manual deletion
  // is documented; no recursive deletion of user directories.
}
