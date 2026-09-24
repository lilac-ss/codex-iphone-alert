import { ECDH } from 'node:crypto';

export function keyBytes(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_key');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== length || bytes.toString('base64url') !== value) throw new Error('invalid_key');
  if (length === 65) {
    if (bytes[0] !== 4) throw new Error('invalid_key');
    try { ECDH.convertKey(bytes, 'prime256v1'); } catch { throw new Error('invalid_key'); }
  }
  return bytes;
}
export function siteUrl(input) {
  const u = new URL(input);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port) throw new Error('invalid_site');
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.href;
}
export function validateSubscription(s, now = Date.now()) {
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 4096) throw new Error('invalid_subscription');
  const u = new URL(s.endpoint);
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash || u.pathname === '/' ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+push\.apple\.com$/.test(u.hostname)) throw new Error('invalid_endpoint');
  keyBytes(s.keys?.p256dh, 65); keyBytes(s.keys?.auth, 16);
  if (s.expirationTime != null && (!Number.isSafeInteger(s.expirationTime) || s.expirationTime <= now)) throw new Error('expired_subscription');
  return { endpoint: u.href, expirationTime: s.expirationTime ?? null, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
export function validateRegistration(data, settings, now = Date.now()) {
  if (data?.version !== 1 || data.applicationServerKey !== settings.vapid.publicKey || data.site !== settings.site) throw new Error('registration_mismatch');
  return validateSubscription(data.subscription, now);
}
