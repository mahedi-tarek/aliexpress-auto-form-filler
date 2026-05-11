import { signUp, signIn, sendPasswordReset, verifySignupOtp, resendSignupOtp, tryRefreshToken } from './auth.js';

// API_BASE and PAYMENT_LINK are injected at build time by webpack DefinePlugin.
const API_BASE     = process.env.API_BASE;
const PAYMENT_LINK = process.env.PAYMENT_LINK;

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const $ = (id) => document.getElementById(id);

function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

const POSITION_SELECT_IDS = ['pos-select-trial', 'pos-select-sub'];

function syncPositionSelects(pos) {
  POSITION_SELECT_IDS.forEach(id => { const el = $(id); if (el) el.value = pos; });
}

// ── Screen management ──────────────────────────────────────────────────────

const SCREENS = ['loading', 'auth', 'otp', 'trial', 'subscribed', 'expired'];

function showScreen(name) {
  SCREENS.forEach(s => {
    $(`screen-${s}`).hidden = (s !== name);
  });
}

function showOverlay(on) {
  $('loading-overlay').hidden = !on;
}

// ── Friendly error messages ────────────────────────────────────────────────

function friendlyError(result) {
  const code = result?.error_code || '';
  const raw  = (
    result?.error?.message ||
    result?.error_description ||
    result?.msg ||
    result?.message ||
    ''
  );
  const low = raw.toLowerCase();

  if (code === 'email_exists'           || /already registered|already exists/.test(low))
    return { msg: 'An account with this email already exists. Try logging in instead.', action: 'switch_login' };

  if (code === 'over_email_send_rate_limit' || /rate limit|sending confirmation|too many emails/.test(low))
    return { msg: 'A verification email was recently sent. Check your inbox (and spam), or wait a minute before requesting another.', action: 'show_otp' };

  if (code === 'weak_password'          || /password.*weak|too short|password.*strong/.test(low))
    return { msg: 'Password is too weak. Please choose a stronger password.', action: null };

  if (code === 'validation_failed'      || /invalid.*email|unable to validate/.test(low))
    return { msg: 'Please enter a valid email address.', action: null };

  if (code === 'signup_disabled'        || /signup.*disabled/.test(low))
    return { msg: 'New sign ups are temporarily unavailable. Please try again later.', action: null };

  if (code === 'invalid_credentials'   || /invalid.*credentials|invalid login/.test(low))
    return { msg: 'Incorrect email or password. Please check your details and try again.', action: null };

  if (code === 'user_not_found'         || /user.*not found|no user/.test(low))
    return { msg: 'No account found with this email. Check the address or sign up instead.', action: 'switch_signup' };

  if (code === 'over_request_rate_limit'|| code === 'too_many_requests' || /too many.*request|rate.*limit/.test(low))
    return { msg: 'Too many attempts. Please wait a few minutes and try again.', action: null };

  if (/otp.*expired|token.*expired|expired.*token|token.*invalid|invalid.*token/.test(low))
    return { msg: 'This code has expired or is incorrect. Request a new code and try again.', action: null };

  if (/network|failed to fetch|load failed|connection/.test(low))
    return { msg: 'Connection failed. Check your internet and try again.', action: null };

  if (/database error|unexpected_failure|trigger|relation .* does not exist|violates .*constraint/.test(low))
    return { msg: `Server error: ${raw}. Please contact support if this keeps happening.`, action: null };

  if (result?.__status >= 500)
    return { msg: `Server error (${result.__status})${raw ? `: ${raw}` : ''}. Please try again in a moment.`, action: null };

  return { msg: raw || null, action: null };
}

// ── Auth screen helpers ────────────────────────────────────────────────────

function showAuthError(msg) {
  const el = $('auth-error');
  el.textContent = msg;
  el.hidden = false;
  $('auth-success').hidden = true;
}

function showAuthSuccess(msg) {
  const el = $('auth-success');
  el.textContent = msg;
  el.hidden = false;
  $('auth-error').hidden = true;
}

function clearAuthMessages() {
  $('auth-error').hidden = true;
  $('auth-success').hidden = true;
}

function switchTab(active) {
  $('tab-signup').classList.toggle('active', active === 'signup');
  $('tab-login').classList.toggle('active', active === 'login');
  $('panel-signup').hidden = active !== 'signup';
  $('panel-login').hidden = active !== 'login';
}

// ── OTP screen helpers ────────────────────────────────────────────────────

function showOtpError(msg) {
  const el = $('otp-error');
  el.textContent = msg;
  el.hidden = false;
  $('otp-success').hidden = true;
}

function showOtpSuccess(msg) {
  const el = $('otp-success');
  el.textContent = msg;
  el.hidden = false;
  $('otp-error').hidden = true;
}

function showOtpScreen(email) {
  $('otp-email').textContent = email;
  $('otp-code').value = '';
  $('otp-error').hidden = true;
  $('otp-success').hidden = true;
  showScreen('otp');
  setTimeout(() => $('otp-code').focus(), 0);
}

// ── Render status to correct screen ───────────────────────────────────────

function renderStatus(status) {
  const { allowed, reason, trialDaysLeft, email, portalUrl } = status;

  if (allowed && reason === 'subscribed') {
    $('subscribed-email').textContent = email || '';
    $('btn-manage').onclick = () => {
      if (portalUrl) chrome.tabs.create({ url: portalUrl });
      else openPaymentLink();
    };
    showScreen('subscribed');
    return;
  }

  if (allowed && (reason === 'trial' || reason === 'grace_period')) {
    $('trial-email').textContent = email || '';
    if (reason === 'trial') {
      $('trial-days').textContent =
        `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your free trial`;
    } else {
      $('trial-days').textContent = 'Grace period — please update your payment';
    }
    showScreen('trial');
    return;
  }

  // Blocked
  const messages = {
    trial_expired: 'Your 7-day free trial has ended.',
    cancelled: 'Your subscription has been cancelled.',
    payment_failed: 'Payment failed. Update your card to restore access.',
    expired: 'Your access has expired.',
    unknown: 'Something went wrong. Please try signing in again.',
  };
  $('expired-reason').textContent = messages[reason] || messages.unknown;
  showScreen('expired');
}

// ── Main init ──────────────────────────────────────────────────────────────

async function init() {
  showScreen('loading');

  const { buttonPosition } = await chrome.storage.local.get('buttonPosition');
  syncPositionSelects(buttonPosition || 'top-right');

  const stored = await chrome.storage.local.get(null);

  // Pending OTP verification ALWAYS takes priority — even over a stale
  // accessToken. Otherwise verifyAndRender could clear storage on 401 and
  // wipe pendingOtpEmail before the user gets a chance to enter their code.
  if (stored.pendingOtpEmail) {
    showOtpScreen(stored.pendingOtpEmail);
    return;
  }

  if (!stored.accessToken) {
    showScreen('auth');
    return;
  }

  // Use cached status if still fresh
  if (stored.authStatus && Date.now() < stored.authStatus.expiresAt) {
    renderStatus(stored.authStatus);
    return;
  }

  // Re-verify with backend
  await verifyAndRender(stored.accessToken, stored.refreshToken);
}

async function verifyAndRender(accessToken, refreshToken) {
  try {
    let status;

    try {
      const res = await fetchWithTimeout(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt: accessToken }),
      });

      if (res.status === 401) {
        // Try refreshing the token
        const newToken = await tryRefreshToken(refreshToken);
        if (!newToken) {
          // Preserve pendingOtpEmail across the wipe — never strand a user
          // mid-verification just because a stale token expired.
          const { pendingOtpEmail } = await chrome.storage.local.get('pendingOtpEmail');
          await chrome.storage.local.clear();
          if (pendingOtpEmail) {
            await chrome.storage.local.set({ pendingOtpEmail });
            showOtpScreen(pendingOtpEmail);
          } else {
            showScreen('auth');
            showAuthError('Session expired. Please log in again.');
          }
          return;
        }
        const res2 = await fetchWithTimeout(`${API_BASE}/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jwt: newToken }),
        });
        status = await res2.json();
      } else {
        status = await res.json();
      }
    } catch {
      // Network error — fall back to cached status
      const { authStatus } = await chrome.storage.local.get('authStatus');
      if (authStatus) {
        renderStatus(authStatus);
        return;
      }
      showScreen('auth');
      showAuthError('Connection failed. Check your internet and try again.');
      return;
    }

    // Cache the status for 15 minutes
    await chrome.storage.local.set({
      authStatus: { ...status, expiresAt: Date.now() + CACHE_TTL_MS },
    });

    renderStatus(status);
  } catch {
    showScreen('auth');
    showAuthError('Something went wrong. Please try again.');
  }
}

// ── Sign up ────────────────────────────────────────────────────────────────

$('btn-signup').addEventListener('click', async () => {
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const username = $('signup-username').value.trim();

  if (!email || !password) {
    showAuthError('Please fill in both your email and a password.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError('Please enter a valid email address.');
    return;
  }

  showOverlay(true);
  clearAuthMessages();

  let result;
  try {
    result = await signUp(email, password, username);
  } catch {
    showOverlay(false);
    showAuthError('Connection failed. Check your internet and try again.');
    return;
  }

  showOverlay(false);

  // Supabase 500 with "Error sending confirmation email" — no email was sent,
  // so don't route to OTP. Tell the user plainly.
  const rawMsg = (result?.error?.message || result?.msg || result?.message || '').toLowerCase();
  if (result.__status >= 500 && /sending.*(confirmation|email)|email.*sending|smtp/.test(rawMsg)) {
    showAuthError('We couldn\'t send the verification email right now (email service issue). Please try again in a few minutes.');
    return;
  }

  // Other 5xx — auth user may have been created and email sent before a
  // downstream failure. Route to OTP so the user can still verify if a code arrives.
  if (result.__status >= 500) {
    await chrome.storage.local.set({ pendingOtpEmail: email });
    showOtpScreen(email);
    showOtpError('Server hiccup during sign up. If a code arrived in your email, enter it below — otherwise tap "Resend code".');
    return;
  }

  if (result.error || result.error_code || (result.code && !result.access_token)) {
    const { msg, action } = friendlyError(result);

    // Unconfirmed account — just route to OTP with a clear explanation
    if (action === 'show_otp') {
      await chrome.storage.local.set({ pendingOtpEmail: email });
      showOtpScreen(email);
      showOtpError('A code was already sent to this email. Enter it below, or use "Resend code" after a minute.');
      return;
    }
    if (action === 'switch_login') {
      showAuthError(msg || 'This email is already registered. Try logging in.');
      switchTab('login');
      $('login-email').value = email;
      return;
    }
    showAuthError(msg || 'Sign up failed. Please try again.');
    return;
  }

  // Email confirmation off — Supabase returned session immediately
  if (result.access_token) {
    await chrome.storage.local.set({
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      userEmail: email,
    });
    showOverlay(true);
    await verifyAndRender(result.access_token, result.refresh_token);
    showOverlay(false);
    return;
  }

  // Normal path — confirmation email sent
  await chrome.storage.local.set({ pendingOtpEmail: email });
  showOtpScreen(email);
});

// ── Log in ─────────────────────────────────────────────────────────────────

$('btn-login').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;

  if (!email || !password) {
    showAuthError('Please enter your email and password.');
    return;
  }

  showOverlay(true);
  clearAuthMessages();

  let session;
  try {
    session = await signIn(email, password);
  } catch {
    showOverlay(false);
    showAuthError('Connection failed. Check your internet and try again.');
    return;
  }

  if (!session.access_token) {
    showOverlay(false);
    const raw = session.error_description || session.msg || session.error?.message || '';

    if (/not.*confirmed|confirm/i.test(raw)) {
      await chrome.storage.local.set({ pendingOtpEmail: email });
      showOtpScreen(email);
      showOtpError('Your email isn\'t verified yet. Enter the code from your inbox, or tap "Resend code".');
      resendSignupOtp(email).catch(() => {});
      return;
    }

    const { msg, action } = friendlyError(session);
    if (action === 'switch_signup') {
      showAuthError(msg || 'No account found. Try signing up.');
      switchTab('signup');
      $('signup-email').value = email;
      return;
    }
    showAuthError(msg || 'Sign in failed. Please check your details and try again.');
    return;
  }

  await chrome.storage.local.set({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userEmail: email,
  });

  await verifyAndRender(session.access_token, session.refresh_token);
  showOverlay(false);
});

// ── Forgot password ────────────────────────────────────────────────────────

$('btn-forgot').addEventListener('click', async () => {
  const email = $('login-email').value.trim();
  if (!email) {
    showAuthError('Enter your email address above first.');
    return;
  }
  try {
    await sendPasswordReset(email);
    // Supabase always returns success here even if email doesn't exist (security)
    showAuthSuccess('If this email is registered, a reset link is on its way. Check your inbox.');
  } catch {
    showAuthError('Connection failed. Check your internet and try again.');
  }
});

// ── Tab switching ──────────────────────────────────────────────────────────

$('tab-signup').addEventListener('click', () => { switchTab('signup'); clearAuthMessages(); });
$('tab-login').addEventListener('click', () => { switchTab('login'); clearAuthMessages(); });
$('btn-go-signup').addEventListener('click', () => { switchTab('signup'); clearAuthMessages(); });
$('btn-go-login').addEventListener('click', () => { switchTab('login'); clearAuthMessages(); });

// ── OTP verify / resend / back ────────────────────────────────────────────

$('btn-verify').addEventListener('click', async () => {
  const code = $('otp-code').value.trim();
  const { pendingOtpEmail } = await chrome.storage.local.get('pendingOtpEmail');

  if (!pendingOtpEmail) {
    showScreen('auth');
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    showOtpError('Enter the 6-digit code from your email.');
    return;
  }

  showOverlay(true);
  const result = await verifySignupOtp(pendingOtpEmail, code);
  showOverlay(false);

  if (!result.access_token) {
    const { msg } = friendlyError(result);
    showOtpError(msg || 'Incorrect or expired code. Try again or tap "Resend code".');
    $('otp-code').value = '';
    $('otp-code').focus();
    return;
  }

  // Show success before transitioning
  $('otp-code').disabled = true;
  $('btn-verify').disabled = true;
  $('btn-resend').disabled = true;
  showOtpSuccess('Email verified! Signing you in...');

  // Optimistic 7-day trial state — the user just confirmed their email, so
  // treat them as a fresh trial user immediately. The background worker will
  // refresh this with real status from the backend on its next tick. If the
  // backend is unreachable, the user stays logged in instead of being bounced
  // back to the auth screen.
  const fallbackStatus = {
    allowed: true,
    reason: 'trial',
    trialDaysLeft: 7,
    email: pendingOtpEmail,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  await chrome.storage.local.set({
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    userEmail: pendingOtpEmail,
    authStatus: fallbackStatus,
  });
  await chrome.storage.local.remove('pendingOtpEmail');

  await new Promise(r => setTimeout(r, 900));

  // Try to fetch real status from the backend. On any failure, keep the
  // optimistic trial state we just cached so the user remains logged in.
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt: result.access_token }),
    });
    if (res.ok) {
      const status = await res.json();
      await chrome.storage.local.set({
        authStatus: { ...status, expiresAt: Date.now() + CACHE_TTL_MS },
      });
      renderStatus(status);
    } else {
      console.warn('[popup] backend /auth/verify returned', res.status, '— using trial fallback');
      renderStatus(fallbackStatus);
    }
  } catch (err) {
    console.warn('[popup] backend /auth/verify unreachable — using trial fallback', err);
    renderStatus(fallbackStatus);
  }

  // Re-enable controls
  $('otp-code').disabled = false;
  $('btn-verify').disabled = false;
  $('btn-resend').disabled = false;
});

$('btn-resend').addEventListener('click', async () => {
  const { pendingOtpEmail } = await chrome.storage.local.get('pendingOtpEmail');
  if (!pendingOtpEmail) return;
  showOverlay(true);
  const result = await resendSignupOtp(pendingOtpEmail);
  showOverlay(false);
  if (result?.error || result?.error_code || (result?.code && result?.msg)) {
    const { msg } = friendlyError(result);
    showOtpError(msg || 'Could not resend. Please wait a moment and try again.');
    return;
  }
  showOtpSuccess('New code sent! Check your inbox.');
});

$('btn-otp-back').addEventListener('click', async () => {
  await chrome.storage.local.remove('pendingOtpEmail');
  switchTab('login');
  clearAuthMessages();
  showScreen('auth');
});

$('otp-code').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
  if (e.target.value.length === 6) {
    $('btn-verify').click();
  }
});

$('otp-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btn-verify').click();
});

// ── Enter key support ──────────────────────────────────────────────────────

$('signup-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btn-signup').click();
});
$('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('btn-login').click();
});

// ── Subscribe buttons ──────────────────────────────────────────────────────

async function openPaymentLink() {
  const { userEmail } = await chrome.storage.local.get('userEmail');
  const url = userEmail
    ? `${PAYMENT_LINK}?prefilled_email=${encodeURIComponent(userEmail)}`
    : PAYMENT_LINK;
  chrome.tabs.create({ url });
}

$('btn-subscribe-trial').addEventListener('click', openPaymentLink);
$('btn-subscribe-expired').addEventListener('click', openPaymentLink);

// ── Sign out ───────────────────────────────────────────────────────────────

async function signOut() {
  await chrome.storage.local.clear();
  showScreen('auth');
  switchTab('login');
}

$('btn-signout-trial').addEventListener('click', signOut);
$('btn-signout-sub').addEventListener('click', signOut);
$('btn-signout-expired').addEventListener('click', signOut);

// ── Button position selector ───────────────────────────────────────────────

async function onPositionChange(e) {
  const pos = e.target.value;
  await chrome.storage.local.set({ buttonPosition: pos });
  syncPositionSelects(pos);
}

POSITION_SELECT_IDS.forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', onPositionChange);
});

// ── Boot ───────────────────────────────────────────────────────────────────

init();
