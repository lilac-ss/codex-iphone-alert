import { createHmac } from 'node:crypto';

const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : null;
export function normalizeEvent(payload, source, now, salt, observed) {
  let kind, ids;
  if (source === 'notify' && payload?.type === 'agent-turn-complete') {
    kind = 'complete'; ids = [identifier(payload['thread-id']), identifier(payload['turn-id'])];
  } else if (source === 'hook' && payload?.hook_event_name === 'PermissionRequest') {
    kind = 'permission';
    // PermissionRequest does not guarantee a tool_use_id. Without it, requests
    // for the same tool in one turn coalesce, without reading tool_input.
    ids = [identifier(payload.session_id), identifier(payload.turn_id), identifier(payload.tool_name)];
    if (identifier(payload.tool_use_id)) ids.push(payload.tool_use_id);
  } else return null;
  if (ids.some(x => !x) || !Number.isSafeInteger(now)) return null;
  const id = createHmac('sha256', salt).update(JSON.stringify([kind, ...ids])).digest('hex');
  return { id, kind, at: now, observed: { locked: bool(observed?.locked), codexFront: bool(observed?.codexFront) } };
}
const bool = v => v === true || v === false ? v : null;
export const acknowledged = os => os?.locked === false && os?.codexFront === true;
export function validEvent(e, now) {
  return e && /^[a-f0-9]{64}$/.test(e.id) && ['complete','permission'].includes(e.kind)
    && Number.isSafeInteger(e.at) && e.at > 0 && e.at <= now + 2000;
}
