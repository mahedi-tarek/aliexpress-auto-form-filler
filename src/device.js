// Stable per-install identifier for per-seat licensing.
//
// This lives in chrome.storage.local, which is scoped to ONE Chrome profile.
// So "device" here means one browser profile, not one physical machine — a
// browser sandbox cannot read hardware IDs. The server counts these against the
// account's DEVICE_LIMIT to enforce the seat. See backend/src/routes/auth.js.

export async function getDeviceId() {
  const { deviceId } = await chrome.storage.local.get('deviceId');
  if (deviceId) return deviceId;

  const id = (self.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await chrome.storage.local.set({ deviceId: id });
  return id;
}

// A short human-readable hint (browser + OS) shown in the "manage devices" list
// so a customer can tell which install to remove. Best-effort only.
export function getDeviceLabel() {
  const ua = (self.navigator && navigator.userAgent) || '';

  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Brave/.test(ua)) browser = 'Brave';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';

  let os = 'Unknown OS';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';

  return `${browser} on ${os}`;
}
