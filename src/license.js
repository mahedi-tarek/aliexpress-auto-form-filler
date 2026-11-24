// Decides whether this install may fill forms right now.
//
// The backend returns a status token signed with its private ECDSA key. We
// verify it here against the public key baked into the extension, and check
// that it was issued for THIS device and hasn't expired. Editing
// chrome.storage by hand can't produce a valid signature, so it can't unlock
// the extension.
import { STATUS_PUBLIC_JWK } from './statusKey.js';
import { getDeviceId } from './device.js';

let keyPromise = null;
function publicKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'jwk', STATUS_PUBLIC_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
  }
  return keyPromise;
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Returns the verified claims ({ sub, dev, ok, exp }) or null.
export async function verifyStatusToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      await publicKey(),
      b64urlToBytes(parts[1]),
      new TextEncoder().encode(parts[0])
    );
    if (!valid) return null;
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return null;
  }
}

export async function isLicensed() {
  const { authStatus } = await chrome.storage.local.get('authStatus');
  if (!authStatus || !authStatus.token) return false;

  const claims = await verifyStatusToken(authStatus.token);
  if (!claims || claims.ok !== true) return false;
  if (claims.dev !== await getDeviceId()) return false;

  const now = Date.now();
  if (now >= claims.exp) {
    chrome.runtime.sendMessage({ type: 'REVALIDATE' }).catch(() => {});
    return false;
  }

  // Cached status is getting old — refresh in the background for next time.
  if (authStatus.expiresAt && now > authStatus.expiresAt) {
    chrome.runtime.sendMessage({ type: 'REVALIDATE' }).catch(() => {});
  }
  return true;
}
