// API_BASE / PAYMENT_LINK are injected at build time by webpack DefinePlugin.
import { tryRefreshToken } from './auth.js';
import { getDeviceId, getDeviceLabel } from './device.js';

const API_BASE = process.env.API_BASE;
const PAYMENT_LINK = process.env.PAYMENT_LINK;

const ALARM_NAME = 'auth-revalidation';
const REVALIDATION_INTERVAL_MINUTES = 15;
const CACHE_TTL_MS = 15 * 60 * 1000;

let inFlight = null;

function verify(jwt, deviceId, deviceLabel) {
  return fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt, deviceId, deviceLabel }),
  });
}

async function doRevalidate() {
  const stored = await chrome.storage.local.get(['accessToken', 'refreshToken']);
  if (!stored.accessToken) return;

  const deviceId = await getDeviceId();
  const deviceLabel = getDeviceLabel();

  try {
    let res = await verify(stored.accessToken, deviceId, deviceLabel);

    if (res.status === 401) {
      const newToken = await tryRefreshToken(stored.refreshToken);
      if (!newToken) {
        // Session is dead — drop the cached access so the popup asks to log in.
        await chrome.storage.local.remove('authStatus');
        return;
      }
      res = await verify(newToken, deviceId, deviceLabel);
    }

    if (res.ok) {
      const status = await res.json();
      await chrome.storage.local.set({
        authStatus: { ...status, expiresAt: Date.now() + CACHE_TTL_MS },
      });
    }
  } catch {
    // Network error — keep the cached status; its signed token carries its own
    // expiry, so offline use still ends on time.
  }
}

function revalidate() {
  if (!inFlight) inFlight = doRevalidate().finally(() => { inFlight = null; });
  return inFlight;
}

async function openCheckout() {
  const { authStatus, userEmail } = await chrome.storage.local.get(['authStatus', 'userEmail']);
  const url = new URL(PAYMENT_LINK);
  const email = authStatus?.email || userEmail;
  if (email) url.searchParams.set('prefilled_email', email);
  if (authStatus?.userId) url.searchParams.set('client_reference_id', authStatus.userId);
  chrome.tabs.create({ url: url.toString() });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REVALIDATION_INTERVAL_MINUTES });
  revalidate();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REVALIDATION_INTERVAL_MINUTES });
  revalidate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) revalidate();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg?.type === 'REVALIDATE') {
    revalidate().then(() => sendResponse({ done: true }));
    return true;
  }
  if (msg?.type === 'OPEN_CHECKOUT') {
    openCheckout();
  }
  if (msg?.type === 'OPEN_POPUP') {
    // Available in Chrome 127+; ignore if unsupported.
    chrome.action.openPopup?.().catch(() => {});
  }
});
