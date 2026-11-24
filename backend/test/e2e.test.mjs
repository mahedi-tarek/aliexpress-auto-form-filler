import fs from 'fs';
import crypto from 'crypto';
const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const worker = (await import(ROOT + '/backend/src/index.js')).default;
const { STATUS_PUBLIC_JWK } = await import(ROOT + '/src/statusKey.js').catch(async () => {
  const t = fs.readFileSync(ROOT + '/src/statusKey.js', 'utf8').replace('export const', 'globalThis.K =');
  eval(t); return { STATUS_PUBLIC_JWK: globalThis.K };
});

// ── mock DB ──
const db = { users: { 'jwt-alice': { id: '11111111-1111-4111-8111-111111111111', email: 'alice@x.com' },
                      'jwt-bob':   { id: '22222222-2222-4222-8222-222222222222', email: 'bob@x.com' } },
             profiles: [], devices: [], trial_devices: [] };
const SB = 'https://sb.test';
const SOLO = 'price_1TSRQrDaIo6SglLOCXLsvm6t', TEAM = 'price_1Uf7pjDaIo6SglLO4G5zk2hv', PANDA = 'price_panda_other_product';
const stripeSubs = { sub_A: { id: 'sub_A', items: { data: [{ price: { id: SOLO } }] } }, sub_B: { id: 'sub_B', items: { data: [{ price: { id: SOLO } }] } },
  sub_P: { id: 'sub_P', items: { data: [{ price: { id: PANDA } }] } }, sub_T: { id: 'sub_T', items: { data: [{ price: { id: TEAM } }] } } };
let lastPortalBody = '';
function q(url) { const u = new URL(url); const f = {}; for (const [k, v] of u.searchParams) { if (/^(eq|ilike)\./.test(v)) f[k] = v.replace(/^(eq|ilike)\./, ''); } return { table: u.pathname.split('/').pop(), f }; }
let currentIp = '1.1.1.1';
function match(row, f) { return Object.entries(f).every(([k, v]) => String(row[k]).toLowerCase() === decodeURIComponent(v).toLowerCase()); }
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith(SB + '/auth/v1/user')) { const t = opts.headers.Authorization.slice(7); const u = db.users[t]; return u ? Response.json(u) : new Response('no', { status: 401 }); }
  if (url.startsWith('https://api.stripe.com/v1/subscriptions/')) { const id = url.split('/').pop(); return stripeSubs[id] ? Response.json(stripeSubs[id]) : new Response('no', { status: 404 }); }
  if (url.startsWith('https://api.stripe.com')) { lastPortalBody = opts.body; return Response.json({ url: 'https://billing.stripe.com/p/session/test' }); }
  if (url.startsWith('https://api.resend.com')) return Response.json({});
  if (url.startsWith(SB + '/rest/v1/')) {
    const { table, f } = q(url); const rows = db[table]; const m = opts.method || 'GET';
    if (m === 'GET') return Response.json(rows.filter(r => match(r, f)));
    if (m === 'POST') { const b = JSON.parse(opts.body); const key = table === 'trial_devices' ? 'device_id' : table === 'profiles' ? 'id' : null;
      if (key && rows.some(r => r[key] === b[key])) return new Response(null, { status: 201 });
      if (table === 'devices' && rows.some(r => r.account_id === b.account_id && r.device_id === b.device_id)) return new Response(null, { status: 201 });
      rows.push(b); return new Response(null, { status: 201 }); }
    if (m === 'PATCH') { const b = JSON.parse(opts.body); rows.filter(r => match(r, f)).forEach(r => Object.assign(r, b)); return new Response(null, { status: 204 }); }
    if (m === 'DELETE') { db[table] = rows.filter(r => !match(r, f)); return new Response(null, { status: 204 }); }
  }
  throw new Error('unexpected fetch ' + url);
};
const env = { SUPABASE_URL: SB, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_KEY: 'svc', DEVICE_LIMIT: '1', DEVICE_SWAP_COOLDOWN_HOURS: '24',
  STATUS_PRIVATE_KEY: fs.readFileSync(ROOT + '/.secrets/status-private.jwk.json', 'utf8'), STRIPE_WEBHOOK_SECRET: 'whsec_test', IP_HASH_SALT: 'test-salt', STRIPE_SECRET_KEY: 'sk', RESEND_API_KEY: 'r', EXTENSION_ID: 'bgbaeelkdofffpjbfpodcgmjjlnbkbjn' };
const call = async (path, body, headers = {}) => { const r = await worker.fetch(new Request('https://api.test' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': currentIp, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env); return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }; };
const verify = (jwt, deviceId) => call('/auth/verify', { jwt, deviceId, deviceLabel: 'Chrome on macOS' });

// license.js check, same algorithm as extension
const pub = await crypto.webcrypto.subtle.importKey('jwk', STATUS_PUBLIC_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
async function licensed(token, dev) { if (!token) return false; const [p, s] = token.split('.'); const b = x => Buffer.from(x, 'base64url');
  const ok = await crypto.webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b(s), Buffer.from(p)); if (!ok) return false;
  const c = JSON.parse(b(p)); return c.ok === true && c.dev === dev && Date.now() < c.exp; }

async function stripe(event) { const body = JSON.stringify(event); const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');
  const r = await worker.fetch(new Request('https://api.test/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body }), env); return r.status; }

let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const DEV_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', DEV_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let r = await verify('bad', DEV_A); ok(r.status === 401, 'invalid JWT rejected');
r = await call('/auth/verify', { jwt: 'jwt-alice' }); ok(r.status === 400 && r.body.reason === 'update_required', 'missing deviceId refused');
r = await verify('jwt-alice', DEV_A); ok(r.body.allowed && r.body.reason === 'trial' && r.body.trialDaysLeft === 7, 'new signup gets 7-day trial');
ok(await licensed(r.body.token, DEV_A), 'trial token verifies in extension');
ok(!(await licensed(r.body.token, DEV_B)), 'token copied to another device rejected');
const forged = Buffer.from(JSON.stringify({ sub: 'x', dev: DEV_A, ok: true, exp: Date.now() + 1e12 })).toString('base64url') + '.' + r.body.token.split('.')[1];
ok(!(await licensed(forged, DEV_A)), 'forged/edited token rejected');
const tokenExp = JSON.parse(Buffer.from(r.body.token.split('.')[0], 'base64url')).exp;
ok(tokenExp <= Date.now() + 2 * 3600e3 + 1000, 'token expires within 2h');
r = await verify('jwt-alice', DEV_B); ok(!r.body.allowed && r.body.reason === 'device_limit' && !r.body.token, 'second device blocked (limit 1)');
r = await verify('jwt-bob', DEV_A); ok(!r.body.allowed && r.body.reason === 'trial_used' && !r.body.token, 'second account on same computer gets no new trial');
// trial ends
db.profiles.find(p => p.email === 'alice@x.com').trial_ends_at = new Date(Date.now() - 1000).toISOString();
r = await verify('jwt-alice', DEV_A); ok(!r.body.allowed && r.body.reason === 'trial_expired' && !r.body.token, 'expired trial blocked, no token');
ok(db.profiles.find(p => p.email === 'alice@x.com').subscription_status === 'expired', 'profile marked expired');
// trial token capped at trial end
db.profiles.find(p => p.email === 'alice@x.com').subscription_status = 'trialing';
db.profiles.find(p => p.email === 'alice@x.com').trial_ends_at = new Date(Date.now() + 10 * 60e3).toISOString();
r = await verify('jwt-alice', DEV_A); const e2 = JSON.parse(Buffer.from(r.body.token.split('.')[0], 'base64url')).exp;
ok(e2 <= Date.now() + 10 * 60e3 + 1000, 'token never outlives trial end');
db.profiles.find(p => p.email === 'alice@x.com').trial_ends_at = new Date(Date.now() - 1000).toISOString();
await verify('jwt-alice', DEV_A);
// webhook security
let s = await worker.fetch(new Request('https://api.test/webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{}' }), env); ok(s.status === 400, 'webhook with bad signature rejected');
// payment with different email, linked via client_reference_id
s = await stripe({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', client_reference_id: '11111111-1111-4111-8111-111111111111', customer: 'cus_A', subscription: 'sub_A', customer_details: { email: 'other@gmail.com' } } } });
ok(s === 200, 'checkout webhook accepted');
r = await verify('jwt-alice', DEV_A); ok(r.body.allowed && r.body.reason === 'subscribed' && await licensed(r.body.token, DEV_A), 'after payment: subscribed + valid token (different checkout email)');
// email fallback, case-insensitive
await stripe({ type: 'checkout.session.completed', data: { object: { id: 'cs_2', customer: 'cus_B', subscription: 'sub_B', customer_details: { email: 'BOB@X.com' } } } });
r = await verify('jwt-bob', DEV_A); ok(r.body.reason === 'subscribed', 'payment linked by email fallback (case-insensitive) — trial_used user can still subscribe');
// portal
r = await call('/billing/portal', { jwt: 'jwt-alice' }); ok(r.body.url?.startsWith('https://billing.stripe.com') && lastPortalBody.includes('configuration=bpc_'), 'manage subscription portal URL (Address Filler portal config)');
// past_due grace + no extension
await stripe({ type: 'invoice.payment_failed', data: { object: { customer: 'cus_A', subscription: 'sub_A' } } });
const g1 = db.profiles.find(p => p.email === 'alice@x.com').grace_period_end;
await stripe({ type: 'customer.subscription.updated', data: { object: { id: 'sub_A', customer: 'cus_A', status: 'past_due', items: { data: [{ price: { id: SOLO } }] } } } });
ok(db.profiles.find(p => p.email === 'alice@x.com').grace_period_end === g1, 'grace period not extended by repeated events');
r = await verify('jwt-alice', DEV_A); ok(r.body.allowed && r.body.reason === 'grace_period', 'past_due within grace allowed');
await stripe({ type: 'customer.subscription.updated', data: { object: { id: 'sub_A', customer: 'cus_A', status: 'active', items: { data: [{ price: { id: SOLO } }] } } } });
r = await verify('jwt-alice', DEV_A); ok(r.body.reason === 'subscribed', 'payment recovered → active');
await stripe({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_A', customer: 'cus_A', items: { data: [{ price: { id: SOLO } }] } } } });
r = await verify('jwt-alice', DEV_A); ok(!r.body.allowed && r.body.reason === 'cancelled' && !r.body.token, 'cancelled → blocked');
// device swap
const del = await call('/devices/remove', { jwt: 'jwt-alice', deviceId: DEV_A }); ok(del.body.success, 'device removal works');
const del2 = await call('/devices/remove', { jwt: 'jwt-alice', deviceId: DEV_A }); ok(del2.status === 429, 'device swap cooldown enforced');
// CORS
r = await call('/auth/verify', { jwt: 'bad', deviceId: DEV_A }, { Origin: 'https://evil.com' }); ok(!r.headers.get('access-control-allow-origin'), 'CORS blocks other websites');
r = await call('/auth/verify', { jwt: 'bad', deviceId: DEV_A }, { Origin: 'chrome-extension://bgbaeelkdofffpjbfpodcgmjjlnbkbjn' }); ok(r.headers.get('access-control-allow-origin') === 'chrome-extension://bgbaeelkdofffpjbfpodcgmjjlnbkbjn', 'CORS allows store extension');
// ── seat plans ──
db.users['jwt-carol'] = { id: '33333333-3333-4333-8333-333333333333', email: 'carol@agency.com' };
currentIp = '2.2.2.2';
const DEV = i => `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`;
r = await verify('jwt-carol', DEV(1)); ok(r.body.reason === 'trial', 'carol starts trial');
r = await verify('jwt-carol', DEV(2)); ok(r.body.reason === 'device_limit', 'trial is limited to 1 seat');
// other product on the same Stripe account must NOT unlock anything
s = await stripe({ type: 'checkout.session.completed', data: { object: { id: 'cs_P', client_reference_id: '33333333-3333-4333-8333-333333333333', customer: 'cus_C', subscription: 'sub_P', customer_details: { email: 'carol@agency.com' } } } });
r = await verify('jwt-carol', DEV(1)); ok(s === 200 && r.body.reason === 'trial', 'other-product (Panda Scroll) payment ignored');
await stripe({ type: 'customer.subscription.updated', data: { object: { id: 'sub_P', customer: 'cus_C', status: 'active', items: { data: [{ price: { id: PANDA } }] } } } });
ok(db.profiles.find(p => p.email === 'carol@agency.com').subscription_status === 'trialing', 'other-product subscription update ignored');
// team purchase → 20 seats
await stripe({ type: 'checkout.session.completed', data: { object: { id: 'cs_T', client_reference_id: '33333333-3333-4333-8333-333333333333', customer: 'cus_C', subscription: 'sub_T', customer_details: { email: 'carol@agency.com' } } } });
const carol = () => db.profiles.find(p => p.email === 'carol@agency.com');
ok(carol().plan === 'team' && carol().device_limit === 20, 'Team plan stores 20 seats');
let okCount = 0; for (let i = 1; i <= 21; i++) { r = await verify('jwt-carol', DEV(i)); if (r.body.allowed && await licensed(r.body.token, DEV(i))) okCount++; }
ok(okCount === 20 && r.body.reason === 'device_limit', 'Team: 20 computers work, the 21st is blocked');
// downgrade to Solo via portal → only the oldest device keeps working
await stripe({ type: 'customer.subscription.updated', data: { object: { id: 'sub_T', customer: 'cus_C', status: 'active', items: { data: [{ price: { id: SOLO } }] } } } });
const a1 = await verify('jwt-carol', DEV(1)), a5 = await verify('jwt-carol', DEV(5));
ok(carol().device_limit === 1 && a1.body.allowed && !a5.body.allowed && a5.body.reason === 'device_limit', 'downgrade: only oldest seat stays active');
// trial throttle per network
currentIp = '9.9.9.9';
for (const n of ['d1', 'd2', 'd3', 'd4']) db.users['jwt-' + n] = { id: crypto.randomUUID(), email: n + '@x.com' };
const t1 = await verify('jwt-d1', 'dddddddd-0001'), t2 = await verify('jwt-d2', 'dddddddd-0002'), t3 = await verify('jwt-d3', 'dddddddd-0003'), t4 = await verify('jwt-d4', 'dddddddd-0004');
ok(t1.body.reason === 'trial' && t2.body.reason === 'trial' && t3.body.reason === 'trial' && t4.body.reason === 'trial_unavailable', '4th new trial from same network in 30 days refused');
ok(db.profiles.find(p => p.email === 'd4@x.com').subscription_status === 'trialing', 'network limit does not permanently expire the account');
currentIp = '8.8.8.8'; const t4b = await verify('jwt-d4', 'dddddddd-0004'); ok(t4b.body.reason === 'trial', 'same account can start trial from another network');
ok(db.trial_devices.every(t => !t.ip_hash || /^[0-9a-f]{64}$/.test(t.ip_hash)), 'only hashed IPs stored');
// invoice for another product's subscription is ignored
await stripe({ type: 'invoice.payment_failed', data: { object: { customer: 'cus_C', parent: { subscription_details: { subscription: 'sub_P' } } } } });
ok(carol().subscription_status === 'active', 'other-product failed invoice ignored');

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
