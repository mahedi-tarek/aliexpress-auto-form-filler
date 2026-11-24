// Supabase REST API helpers (no npm package — pure fetch for Cloudflare Workers)

function authHeaders(env, userJwt = null) {
  // Prefer service key (bypasses RLS). Fall back to user JWT + anon key.
  if (env.SUPABASE_SERVICE_KEY) {
    return {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'apikey': env.SUPABASE_SERVICE_KEY,
    };
  }
  return {
    'Authorization': `Bearer ${userJwt}`,
    'apikey': env.SUPABASE_ANON_KEY,
  };
}

export async function getUserFromJwt(jwt, env) {
  // /auth/v1/user only needs the user JWT + any valid project key (anon is fine)
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'apikey': env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getProfileById(userId, env, userJwt = null) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
    { headers: authHeaders(env, userJwt) }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getProfileByEmail(email, env, userJwt = null) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;
  // ilike gives case-insensitivity but treats % and _ as wildcards, so the
  // candidates are re-checked for an exact (case-folded) match below.
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?email=ilike.${encodeURIComponent(target)}&select=*`,
    { headers: authHeaders(env, userJwt) }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.find(r => String(r.email || '').toLowerCase() === target) ?? null;
}

export async function getProfileByStripeCustomer(customerId, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}&select=*`,
    { headers: authHeaders(env) }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function insertProfile(profile, env, userJwt = null) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(env, userJwt),
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify(profile),
    }
  );
  return res.ok;
}

export async function updateProfile(userId, fields, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(env),
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
    }
  );
  return res.ok;
}

// ── Device binding (per-seat licensing) ─────────────────────────────────────
// These all use the service key (authHeaders with no JWT) so the Worker can
// read/write device rows for any account regardless of RLS.

export async function listDevices(accountId, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/devices?account_id=eq.${accountId}&select=device_id,label,created_at,last_seen&order=created_at.asc`,
    { headers: authHeaders(env) }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function insertDevice({ accountId, deviceId, label }, env) {
  const now = new Date().toISOString();
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/devices`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(env),
        'Content-Type': 'application/json',
        // ignore-duplicates guards the (account_id, device_id) unique index
        // against a double-tap race registering the same device twice.
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ account_id: accountId, device_id: deviceId, label, created_at: now, last_seen: now }),
    }
  );
  return res.ok;
}

export async function touchDevice(accountId, deviceId, env) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/devices?account_id=eq.${accountId}&device_id=eq.${encodeURIComponent(deviceId)}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(env),
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ last_seen: new Date().toISOString() }),
    }
  );
}

export async function deleteDevice(accountId, deviceId, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/devices?account_id=eq.${accountId}&device_id=eq.${encodeURIComponent(deviceId)}`,
    {
      method: 'DELETE',
      headers: { ...authHeaders(env), 'Prefer': 'return=minimal' },
    }
  );
  return res.ok;
}

// ── Trial abuse guard ────────────────────────────────────────────────────────
// One free trial per install, and at most a few new trials per network per
// month. Returns the account id that claimed this device's trial, or null.
export async function getTrialClaim(deviceId, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/trial_devices?device_id=eq.${encodeURIComponent(deviceId)}&select=account_id`,
    { headers: authHeaders(env) }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.account_id ?? null;
}

// Number of trials started from this (hashed) network address since `sinceIso`.
export async function countRecentTrialsFromIp(ipHash, sinceIso, env) {
  if (!ipHash) return 0;
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/trial_devices?ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=account_id`,
    { headers: authHeaders(env) }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return new Set(rows.map(r => r.account_id)).size;
}

export async function claimTrialDevice(deviceId, accountId, ipHash, env) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/trial_devices`, {
    method: 'POST',
    headers: {
      ...authHeaders(env),
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify({ device_id: deviceId, account_id: accountId, ip_hash: ipHash || null }),
  });
}
