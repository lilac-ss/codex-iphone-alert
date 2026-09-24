#!/usr/bin/env node
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { defaultHome, privateDir, assertOutsideRepo, readText, readJson, atomicJson } from '../lib/store.mjs';
import { sourceRoot, install, uninstall } from '../lib/install.mjs';
import { siteUrl, validateRegistration } from '../lib/subscription.mjs';
import { receive, readStdin } from '../lib/ingress.mjs';
import { runDaemon } from '../lib/daemon.mjs';
import { macState } from '../lib/mac.mjs';

const args = process.argv.slice(2), command = args.shift() ?? 'help';
function option(name) {
  const at = args.indexOf(name); if (at === -1) return undefined;
  if (!args[at + 1]) throw new Error('missing_option');
  return args.splice(at, 2)[1];
}
const home = path.resolve(option('--home') ?? defaultHome());
const output = data => console.log(JSON.stringify(data, null, 2));
try {
  if (command === 'notify') await receive(home, 'notify', args.at(-1), args);
  else if (command === 'hook') await receive(home, 'hook', await readStdin());
  else if (command === 'init') {
    privateDir(home); assertOutsideRepo(home, sourceRoot);
    const file = path.join(home, 'settings.json');
    if (!existsSync(file)) {
      const site = siteUrl(option('--site'));
      atomicJson(file, { version: 1, site, vapid: { ...webpush.generateVAPIDKeys(), subject: site }, dedupSalt: randomBytes(32).toString('hex') });
    }
    const s = readJson(file);
    output({ ready: true, registrationUrl: s.site + '#key=' + s.vapid.publicKey });
  } else if (command === 'registration-url') {
    const s = readJson(path.join(home, 'settings.json'));
    output({ registrationUrl: s.site + '#key=' + s.vapid.publicKey });
  } else if (command === 'import') {
    const s = readJson(path.join(home, 'settings.json'));
    const subscription = validateRegistration(JSON.parse(readText(path.resolve(args[0]), undefined, 16_384)), s);
    atomicJson(path.join(home, 'device.json'), { subscription, importId: randomUUID(), importedAt: Date.now(), disabled: false });
    output({ imported: true });
  } else if (command === 'test') {
    const device = readJson(path.join(home, 'device.json'));
    if (device.disabled) throw new Error('device_disabled');
    const status = readJson(path.join(home, 'status.json'), null);
    if (!status || Date.now() - status.updatedAt > 15_000) throw new Error('daemon_not_running');
    atomicJson(path.join(home, 'test-request.json'), { at: Date.now() });
    output({ queued: true, note: '1回だけ送信します。受信はiPhoneで確認してください。' });
  } else if (command === 'stop') {
    atomicJson(path.join(home, 'control.json'), { stopAt: Date.now() });
    output({ stopRequested: true, note: '次の確認周期で停止します。Appleへ渡した通知は届く場合があります。' });
  } else if (command === 'status') {
    const status = readJson(path.join(home, 'status.json'), null);
    const device = readJson(path.join(home, 'device.json'), null);
    output({ initialized: existsSync(path.join(home, 'settings.json')), installed: existsSync(path.join(home, 'integration.json')),
      daemonFresh: status ? Date.now() - status.updatedAt < 15_000 : false,
      device: device ? (device.disabled ? 'invalid' : 'registered') : 'missing', status,
      health: readJson(path.join(home, 'health.json'), null) });
  } else if (command === 'probe') output(await macState());
  else if (command === 'install') output(install(home));
  else if (command === 'uninstall') { uninstall(home); output({ uninstalled: true, backupsRetained: true }); }
  else if (command === 'daemon') await runDaemon(home);
  else if (command === 'help') console.log('init --site HTTPS_URL | registration-url | install | import FILE | test | status | stop | probe | uninstall\n保存先指定: --home DIRECTORY（通常は不要）');
  else throw new Error('unknown_command');
} catch (error) {
  if (!['notify','hook'].includes(command)) {
    // Never expose parser, HTTP, file contents, or arbitrary error messages.
    const known = new Set(['missing_option','state_in_repository','unsafe_file','unsafe_directory','invalid_key','invalid_endpoint','invalid_subscription','expired_subscription','registration_mismatch','invalid_site','native_build_required','hooks_disabled','integration_modified','installation_incomplete','notify_modified','hook_modified','launchagent_exists','daemon_running','daemon_not_running','mac_only','device_disabled','unknown_command']);
    console.error('処理できませんでした: ' + (known.has(error.message) ? error.message : 'operation_failed'));
    process.exitCode = 1;
  }
}
