// Supabase auth via REST API — no npm package needed in the extension
// TODO: Replace these two values with your actual Supabase project details
export const SUPABASE_URL = 'https://tahjkdlttlxgqhoxjqxd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaGprZGx0dGx4Z3Fob3hqcXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTk2MjAsImV4cCI6MjA5MzMzNTYyMH0.7k1XKp2g6iOzetJZZWTI-Gqh1okTwJumWLkLgNpw2c8';

function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

export async function signUp(email, password) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
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
