import https from 'node:https';
import webpush from 'web-push';
import { validateSubscription } from './subscription.mjs';

// Only web-push performs encryption and VAPID signing. Node handles transport
// to impose an absolute timeout and to discard response bodies immediately.
export function createSender({ request = https.request, now = Date.now } = {}) {
  const auth = new Map();
  return async (subscription, vapid, payload, ttl) => {
    try {
      const s = validateSubscription(subscription, now());
      const audience = new URL(s.endpoint).origin;
      let cached = auth.get(audience);
      if (!cached || now() - cached.at >= 3600_000 || now() < cached.at) {
        cached = { at: now(), header: webpush.getVapidHeaders(audience, vapid.subject, vapid.publicKey, vapid.privateKey, 'aes128gcm', Math.floor(now()/1000) + 12*3600).Authorization };
        auth.set(audience, cached);
      }
      const details = webpush.generateRequestDetails(s, JSON.stringify(payload), {
        TTL: ttl, urgency: 'high', topic: 'codex-iphone-alert', contentEncoding: 'aes128gcm', headers: { Authorization: cached.header }
      });
      return await new Promise(resolve => {
        let done = false, timer;
        const finish = result => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
        const req = request(details.endpoint, { method: 'POST', headers: details.headers }, res => {
          // No redirects, payloads, endpoints, or remote error strings in logs.
          const code = res.statusCode;
          let bytes = 0;
          res.on('data', chunk => { bytes += chunk.length; if (bytes > 8192) req.destroy(); });
          res.on('end', () => finish({ ok: code >= 200 && code < 300, code, invalid: code === 404 || code === 410 }));
          res.on('error', () => finish({ ok: false, code: 'network' }));
          res.on('aborted', () => finish({ ok: false, code: 'network' }));
          res.resume();
        });
        req.on('error', () => finish({ ok: false, code: 'network' }));
        timer = setTimeout(() => { finish({ ok: false, code: 'timeout' }); req.destroy(); }, 10_000);
        req.end(details.body);
      });
    } catch { return { ok: false, code: 'invalid' }; }
  };
}
