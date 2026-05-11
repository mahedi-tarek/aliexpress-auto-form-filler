// Supabase auth via REST API — no npm package needed in the extension.
// SUPABASE_URL and SUPABASE_ANON_KEY are injected at build time by webpack DefinePlugin.
export const SUPABASE_URL      = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export async function signUp(email, password, username) {
  const body = { email, password };
  if (username) body.data = { username };
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  data.__status = res.status;
  return data;
}

export async function signIn(email, password) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  data.__status = res.status;
  return data;
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return res.json();
}

// Shared helper used by both popup.js and background.js.
// Attempts a silent token refresh and persists new tokens to chrome.storage.
// Returns the new access token on success, or null on any failure.
export async function tryRefreshToken(refreshToken) {
  if (!refreshToken) return null;
  try {
    const result = await refreshAccessToken(refreshToken);
    if (result.access_token) {
      await chrome.storage.local.set({
        accessToken:  result.access_token,
        refreshToken: result.refresh_token || refreshToken,
      });
      return result.access_token;
    }
  } catch {
    // Network error during refresh — keep existing tokens
  }
  return null;
}

export async function sendPasswordReset(email) {
  await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email }),
  });
}

export async function verifySignupOtp(email, token) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, token, type: 'signup' }),
  });
  const data = await res.json().catch(() => ({}));
  data.__status = res.status;
  return data;
}

export async function resendSignupOtp(email) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, type: 'signup' }),
  });
  const data = await res.json().catch(() => ({}));
  data.__status = res.status;
  return data;
}
