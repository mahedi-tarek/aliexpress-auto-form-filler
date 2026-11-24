function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifies a Stripe-Signature header (t=...,v1=...,v1=...) against the raw body.
export async function verifyStripeSignature(payload, header, secret) {
  if (!secret || !header) return false;

  let timestamp = null;
  const signatures = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') timestamp = v;
    else if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || !signatures.length) return false;

  const tolerance = 300; // 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expectedHex = Array.from(new Uint8Array(expected))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some(sig => timingSafeEqual(sig, expectedHex));
}

// ── Signed access tokens ────────────────────────────────────────────────────
// The extension only unlocks filling when it holds a status token signed with
// STATUS_PRIVATE_KEY (ECDSA P-256 JWK). The public key is baked into the
// extension, so editing chrome.storage by hand cannot grant access.

function b64url(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedKey = null;
async function signingKey(env) {
  if (cachedKey) return cachedKey;
  if (!env.STATUS_PRIVATE_KEY) return null;
  const jwk = JSON.parse(env.STATUS_PRIVATE_KEY);
  cachedKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  return cachedKey;
}

// Returns "<payload>.<signature>" (both base64url) or null if no key configured.
export async function signStatusToken(claims, env) {
  const key = await signingKey(env);
  if (!key) return null;
  const payload = b64url(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload)
  );
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}
