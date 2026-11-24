import {
  getUserFromJwt, getProfileById, insertProfile, updateProfile,
  listDevices, insertDevice, touchDevice, getTrialClaim, claimTrialDevice,
} from '../utils/supabase.js';
import { createPortalSession } from '../utils/stripe.js';
import { signStatusToken } from '../utils/crypto.js';

const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// How long a signed "allowed" token stays valid. The extension refreshes every
// 15 minutes, so this only matters when the user is offline.
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function json(data, status = 200) {
  return Response.json(data, { status });
}

function deviceLimit(env) {
  const n = parseInt(env.DEVICE_LIMIT ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function validDeviceId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

// Registers this device against the account, enforcing the per-seat limit.
async function gateDevice(accountId, deviceId, label, env) {
  const limit = deviceLimit(env);
  const devices = await listDevices(accountId, env);
  const known = devices.some(d => d.device_id === deviceId);

  if (known) {
    await touchDevice(accountId, deviceId, env);
    return { ok: true, deviceCount: devices.length, deviceLimit: limit };
  }

  if (devices.length < limit) {
    await insertDevice({ accountId, deviceId, label }, env);
    return { ok: true, deviceCount: devices.length + 1, deviceLimit: limit };
  }

  return { ok: false, deviceCount: devices.length, deviceLimit: limit };
}

async function authenticate(jwt, env) {
  if (!jwt || typeof jwt !== 'string') return null;
  const user = await getUserFromJwt(jwt, env);
  return user && user.id ? user : null;
}

// POST /auth/verify
// Body: { jwt: string, deviceId: string, deviceLabel?: string }
// Returns: { allowed, reason, trialDaysLeft, email, userId, token, deviceCount?, deviceLimit? }
export async function handleAuthVerify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ allowed: false, reason: 'invalid_request' }, 400);
  }

  const { jwt, deviceId } = body || {};
  const deviceLabel = String(body?.deviceLabel || 'Unknown device').slice(0, 120);

  const user = await authenticate(jwt, env);
  if (!user) return json({ allowed: false, reason: 'invalid_token' }, 401);

  // Every build that ships to the store sends a device id. Without one we can't
  // enforce seats or the one-trial-per-device rule, so refuse.
  if (!validDeviceId(deviceId)) {
    return json({ allowed: false, reason: 'update_required', email: user.email }, 400);
  }

  let profile = await getProfileById(user.id, env, jwt);
  if (!profile) {
    const now = new Date().toISOString();
    await insertProfile({
      id: user.id,
      email: user.email,
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
      created_at: now,
      updated_at: now,
    }, env, jwt);
    profile = await getProfileById(user.id, env, jwt);
    if (!profile) return json({ allowed: false, reason: 'no_profile' }, 500);
  }

  const now = new Date();
  const email = profile.email || user.email;
  const base = { email, userId: user.id };

  // ── Step 1: base access decision (subscription/trial state) ───────────────
  let decision;
  let accessUntil = null; // hard cap on token expiry (trial end / grace end)

  switch (profile.subscription_status) {
    case 'active':
      decision = { ...base, allowed: true, reason: 'subscribed', trialDaysLeft: null };
      break;

    case 'past_due':
      if (profile.grace_period_end && now < new Date(profile.grace_period_end)) {
        decision = { ...base, allowed: true, reason: 'grace_period', trialDaysLeft: null };
        accessUntil = new Date(profile.grace_period_end).getTime();
      } else {
        decision = { ...base, allowed: false, reason: 'payment_failed' };
      }
      break;

    case 'cancelled':
      decision = { ...base, allowed: false, reason: 'cancelled' };
      break;

    case 'expired':
      decision = { ...base, allowed: false, reason: 'trial_expired' };
      break;

    case 'trialing': {
      const trialEnd = new Date(profile.trial_ends_at);
      // One trial per install: if another account already used a trial on this
      // device, this account gets no trial (it can still subscribe).
      const claimedBy = await getTrialClaim(deviceId, env);
      if (claimedBy && claimedBy !== profile.id) {
        await updateProfile(profile.id, { subscription_status: 'expired', trial_ends_at: now.toISOString() }, env);
        decision = { ...base, allowed: false, reason: 'trial_used' };
      } else if (now < trialEnd) {
        if (!claimedBy) await claimTrialDevice(deviceId, profile.id, env);
        const daysLeft = Math.ceil((trialEnd - now) / DAY_MS);
        decision = { ...base, allowed: true, reason: 'trial', trialDaysLeft: daysLeft, trialEndsAt: trialEnd.toISOString() };
        accessUntil = trialEnd.getTime();
      } else {
        await updateProfile(profile.id, { subscription_status: 'expired' }, env);
        decision = { ...base, allowed: false, reason: 'trial_expired' };
      }
      break;
    }

    default:
      decision = { ...base, allowed: false, reason: 'unknown' };
  }

  // ── Step 2: device binding (only gate users who otherwise have access) ────
  if (decision.allowed) {
    const gate = await gateDevice(profile.id, deviceId, deviceLabel, env);
    decision.deviceCount = gate.deviceCount;
    decision.deviceLimit = gate.deviceLimit;
    if (!gate.ok) {
      decision = {
        ...base,
        allowed: false,
        reason: 'device_limit',
        deviceCount: gate.deviceCount,
        deviceLimit: gate.deviceLimit,
      };
    }
  }

  // ── Step 3: signed token the extension requires before it will fill ───────
  if (decision.allowed) {
    let exp = Date.now() + TOKEN_TTL_MS;
    if (accessUntil) exp = Math.min(exp, accessUntil);
    decision.token = await signStatusToken({ sub: user.id, dev: deviceId, ok: true, exp }, env);
  }

  return json(decision);
}

// POST /billing/portal
// Body: { jwt }
// Returns a one-time Stripe customer-portal URL for subscribers.
export async function handleBillingPortal(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  const user = await authenticate(body?.jwt, env);
  if (!user) return json({ error: 'invalid_token' }, 401);

  const profile = await getProfileById(user.id, env);
  if (!profile?.stripe_customer_id) return json({ error: 'no_customer' }, 404);

  const session = await createPortalSession(
    profile.stripe_customer_id,
    env.STRIPE_SECRET_KEY,
    env.PORTAL_RETURN_URL || 'https://autoformfiller.xyz'
  );
  if (!session?.url) return json({ error: 'portal_failed' }, 502);
  return json({ url: session.url });
}
