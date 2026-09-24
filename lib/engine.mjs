import { INTERVAL, LIFETIME, DEDUP_LIFETIME } from './constants.mjs';
import { acknowledged, validEvent } from './events.mjs';

export const initialState = () => ({ version: 1, pending: [], seen: {}, lastAttempt: 0, lastNow: 0, attempts: 0, accepted: { complete: 0, permission: 0 } });
export function step(previous, { now, events = [], os = {}, stopAt = 0, enabled = true }) {
  const s = structuredClone(previous);
  const backwards = now < s.lastNow;
  s.lastNow = now;
  s.seen = Object.fromEntries(Object.entries(s.seen).filter(([,until]) => until > now));
  s.pending = backwards ? [] : s.pending.filter(e => e.at + LIFETIME > now && e.at > stopAt);
  for (const e of events) {
    if (!validEvent(e, now) || s.seen[e.id]) continue;
    s.seen[e.id] = e.at + DEDUP_LIFETIME;
    s.accepted[e.kind]++;
    if (e.at <= stopAt || e.at + LIFETIME <= now || acknowledged(e.observed) || backwards) continue;
    s.pending.push({ id: e.id, kind: e.kind, at: e.at });
  }
  if (acknowledged(os)) s.pending = [];
  if (backwards) s.lastAttempt = now;
  if (!enabled || !s.pending.length || (s.lastAttempt && now - s.lastAttempt < INTERVAL)) return { state: s, batch: null };
  // One aggregate push at most per minute, even after sleep or a long outage.
  s.lastAttempt = now; s.attempts++;
  const eventsOut = ['complete','permission'].flatMap(kind => {
    const matching = s.pending.filter(e => e.kind === kind);
    return matching.length ? [{ kind, at: Math.max(...matching.map(e => e.at)) }] : [];
  });
  const ttl = Math.min(60, Math.floor((Math.min(...s.pending.map(e => e.at + LIFETIME)) - now) / 1000));
  return { state: s, batch: ttl > 0 ? { payload: { version: 1, events: eventsOut }, ttl } : null };
}
