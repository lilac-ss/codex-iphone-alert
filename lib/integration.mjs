import { parse } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';

// TOML tables use a null prototype. Compare values independent of that detail.
const same = (a, b) => isDeepStrictEqual(structuredClone(a), structuredClone(b));
export const shellQuote = s => "'" + s.replaceAll("'", "'\\''") + "'";
export function notifyRange(text) {
  const full = parse(text);
  if (full.notify === undefined) return null;
  if (!Array.isArray(full.notify) || full.notify.some(x => typeof x !== 'string')) throw new Error('invalid_notify');
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*notify\s*=/.test(lines[i])) {
      let candidate = '';
      for (let j = i; j < lines.length; j++) {
        candidate += lines[j];
        try {
          if (same(parse(candidate).notify, full.notify)) {
            const removed = text.slice(0, offset) + text.slice(offset + candidate.length);
            const rest = { ...full }; delete rest.notify;
            if (same(parse(removed), rest)) return { start: offset, end: offset + candidate.length, raw: candidate, value: full.notify };
          }
        } catch {}
      }
    }
    offset += lines[i].length;
  }
  throw new Error('unsupported_notify_layout');
}
export function installNotify(text, wrapper) {
  const range = notifyRange(text);
  const line = 'notify = ' + JSON.stringify(wrapper) + ' # codex-iphone-alert\n';
  const updated = range ? text.slice(0, range.start) + line + text.slice(range.end) : line + text;
  const expected = { ...parse(text), notify: wrapper };
  if (!same(parse(updated), expected)) throw new Error('config_conflict');
  return { text: updated, previousNotify: range?.value ?? [], previousRaw: range?.raw ?? null, wrapper };
}
export function uninstallNotify(text, installed) {
  const range = notifyRange(text);
  if (!range || !same(range.value, installed.wrapper)) {
    if (range?.value.some(v => installed.wrapper.includes(v) && /alert\.mjs$/.test(v))) throw new Error('notify_modified');
    return text;
  }
  return text.slice(0, range.start) + (installed.previousRaw ?? '') + text.slice(range.end);
}
export function hookDefinition(node, script, home) {
  return { type: 'command', command: [node, script, 'hook', '--home', home].map(shellQuote).join(' '), async: true, timeout: 3, statusMessage: 'Codex iPhone Alert' };
}
export function installHook(doc, handler) {
  const result = structuredClone(doc);
  result.hooks ??= {};
  result.hooks.PermissionRequest ??= [];
  if (!Array.isArray(result.hooks.PermissionRequest)) throw new Error('invalid_hooks');
  const found = result.hooks.PermissionRequest.some(g => g.hooks?.some(h => same(h, handler)));
  if (!found) result.hooks.PermissionRequest.push({ hooks: [structuredClone(handler)] });
  return result;
}
export function uninstallHook(doc, handler) {
  const result = structuredClone(doc);
  if (!result.hooks?.PermissionRequest) return result;
  result.hooks.PermissionRequest = result.hooks.PermissionRequest.flatMap(group => {
    if (!Array.isArray(group.hooks)) throw new Error('invalid_hooks');
    for (const hook of group.hooks) if (hook.command === handler.command && !same(hook, handler)) throw new Error('hook_modified');
    const hooks = group.hooks.filter(h => !same(h, handler));
    return hooks.length ? [{ ...group, hooks }] : [];
  });
  if (!result.hooks.PermissionRequest.length) delete result.hooks.PermissionRequest;
  return result;
}
const xml = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function launchAgent(node, script, home, label) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>${[node,script,'daemon','--home',home].map(a=>`<string>${xml(a)}</string>`).join('')}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>/dev/null</string>
<key>StandardErrorPath</key><string>/dev/null</string>
</dict></plist>\n`;
}
