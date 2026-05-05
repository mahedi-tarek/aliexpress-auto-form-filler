// TODO: Replace with your actual Cloudflare Worker URL after deployment
const API_BASE = 'https://address-filler-api.mhtareqarz.workers.dev';
// TODO: Replace with your Supabase project URL and anon key
const SUPABASE_URL = 'https://tahjkdlttlxgqhoxjqxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaGprZGx0dGx4Z3Fob3hqcXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTk2MjAsImV4cCI6MjA5MzMzNTYyMH0.7k1XKp2g6iOzetJZZWTI-Gqh1okTwJumWLkLgNpw2c8';

const ALARM_NAME = 'auth-revalidation';
const REVALIDATION_INTERVAL_MINUTES = 15;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function tryRefreshToken(refreshToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (data.access_token) {
      await chrome.storage.local.set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
      });
      return data.access_token;
    }
  } catch {
    // Network error during refresh — keep existing tokens
  }
  return null;
}

async function revalidate() {
  const stored = await chrome.storage.local.get(['accessToken', 'refreshToken']);
  if (!stored.accessToken) return;

  try {
    let res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt: stored.accessToken }),
    });

    if (res.status === 401 && stored.refreshToken) {
      const newToken = await tryRefreshToken(stored.refreshToken);
      if (!newToken) return; // Can't refresh — let popup handle re-login
      res = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt: newToken }),
      });
    }

    if (res.ok) {
      const status = await res.json();
      await chrome.storage.local.set({
        authStatus: { ...status, expiresAt: Date.now() + CACHE_TTL_MS },
      });
    }
  } catch {
    // Network error — keep existing cached status so offline usage works
    // within the 15-min window. It will expire naturally.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REVALIDATION_INTERVAL_MINUTES });
  revalidate();
});

chrome.runtime.onStartup.addListener(() => {
  revalidate();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) revalidate();
});
