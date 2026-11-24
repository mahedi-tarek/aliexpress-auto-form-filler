import { getUserFromJwt, getProfileById, listDevices, deleteDevice, updateProfile } from '../utils/supabase.js';

function json(data, status = 200) {
  return Response.json(data, { status });
}

function swapCooldownMs(env) {
  const hours = parseInt(env.DEVICE_SWAP_COOLDOWN_HOURS ?? '24', 10);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 24) * 60 * 60 * 1000;
}

function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.replace(/^Bearer\s+/i, '').trim();
}

// GET /devices?current=<deviceId>
// Auth: Authorization: Bearer <supabase jwt>
// Lists the account's registered devices so the popup can show a manage/remove UI.
export async function handleListDevices(request, env) {
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'no_token' }, 401);

  const user = await getUserFromJwt(jwt, env);
  if (!user || !user.id) return json({ error: 'invalid_token' }, 401);

  const url = new URL(request.url);
  const current = url.searchParams.get('current');

  const devices = await listDevices(user.id, env);
  const profile = await getProfileById(user.id, env);
  const fallback = parseInt(env.DEVICE_LIMIT ?? '1', 10) || 1;
  const paid = profile && (profile.subscription_status === 'active' || profile.subscription_status === 'past_due');
  const limit = paid ? (parseInt(profile.device_limit, 10) || fallback) : fallback;

  return json({
    deviceLimit: limit,
    deviceCount: devices.length,
    devices: devices.map((d, i) => ({
      active: i < limit,
      deviceId: d.device_id,
      label: d.label,
      createdAt: d.created_at,
      lastSeen: d.last_seen,
      isCurrent: !!current && d.device_id === current,
    })),
  });
}

// POST /devices/remove
// Body: { jwt: string, deviceId: string }
// Frees a seat by unregistering a device. Rate-limited to one swap per
// DEVICE_SWAP_COOLDOWN_HOURS so a single license can't be shared by rotating.
export async function handleRemoveDevice(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const { jwt, deviceId } = body;
  if (!jwt) return json({ error: 'no_token' }, 401);
  if (!deviceId) return json({ error: 'no_device' }, 400);

  const user = await getUserFromJwt(jwt, env);
  if (!user || !user.id) return json({ error: 'invalid_token' }, 401);

  const profile = await getProfileById(user.id, env, jwt);
  if (!profile) return json({ error: 'no_profile' }, 401);

  // Seat swaps are throttled so one seat can't be time-shared. Bigger plans
  // get proportionally shorter cooldowns (24h / seats).
  const seats = (profile.subscription_status === 'active' || profile.subscription_status === 'past_due')
    ? Math.max(1, parseInt(profile.device_limit, 10) || 1) : 1;
  const cooldown = Math.floor(swapCooldownMs(env) / seats);
  const last = profile.last_device_change_at ? new Date(profile.last_device_change_at).getTime() : 0;
  const elapsed = Date.now() - last;
  if (cooldown > 0 && last && elapsed < cooldown) {
    const retryAfterHours = Math.ceil((cooldown - elapsed) / (60 * 60 * 1000));
    return json({ error: 'cooldown', retryAfterHours }, 429);
  }

  const devices = await listDevices(user.id, env);
  if (!devices.some(d => d.device_id === deviceId)) {
    return json({ error: 'device_not_found' }, 404);
  }

  const ok = await deleteDevice(user.id, deviceId, env);
  if (!ok) return json({ error: 'remove_failed' }, 500);

  await updateProfile(user.id, { last_device_change_at: new Date().toISOString() }, env);

  return json({ success: true });
}
