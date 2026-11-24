import { verifyStripeSignature } from '../utils/crypto.js';
import { getProfileById, getProfileByEmail, getProfileByStripeCustomer, updateProfile } from '../utils/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function fromAddress(env) {
  return env.RESEND_FROM || 'AliExpress Address Filler <noreply@autoformfiller.xyz>';
}

async function sendWelcomeEmail(email, env) {
  if (!env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(env),
      to: email,
      subject: "You're subscribed — AliExpress Address Filler",
      html: `
        <h2>You're all set!</h2>
        <p>Your subscription is now active. Open the extension in Chrome and log in with your account to use all features.</p>
        <p>If you ever need to manage your subscription (cancel, update billing), click "Manage Subscription" inside the extension popup.</p>
        <p>Thanks for subscribing!</p>
      `,
    }),
  });
}

async function sendPaymentFailedEmail(email, env) {
  if (!env.RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(env),
      to: email,
      subject: 'Payment failed — action required',
      html: `
        <h2>Payment failed</h2>
        <p>We couldn't process your payment for AliExpress Address Filler.</p>
        <p>You have a 3-day grace period to update your payment method before access is suspended.</p>
        <p>To update your billing details, open the extension and click "Manage Subscription".</p>
      `,
    }),
  });
}

export async function handleWebhook(request, env) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Missing signature', { status: 400 });
  }

  const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);

  try {
    await processEvent(event, env);
  } catch (err) {
    // Non-2xx makes Stripe retry later, so a transient Supabase error doesn't
    // silently lose a payment.
    return new Response('Processing failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
}

async function processEvent(event, env) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      if (!subscriptionId) break;

      // Prefer the Supabase user id the extension passes as client_reference_id
      // (works even if the customer types a different email at checkout).
      // Fall back to matching the checkout email.
      let profile = null;
      const ref = session.client_reference_id;
      if (ref && UUID_RE.test(ref)) profile = await getProfileById(ref, env);
      if (!profile) {
        const email = session.customer_details?.email || session.customer_email;
        if (email) profile = await getProfileByEmail(email, env);
      }
      if (!profile) {
        console.error('checkout.session.completed: no matching profile', session.id);
        break;
      }
      // Never re-point an account that already has a live subscription with a
      // different Stripe customer (e.g. someone paying with a forged
      // client_reference_id or look-alike email).
      if (profile.subscription_status === 'active' && profile.stripe_customer_id && profile.stripe_customer_id !== customerId) {
        console.error('checkout.session.completed: profile already subscribed under another customer', session.id);
        break;
      }

      const ok = await updateProfile(profile.id, {
        stripe_customer_id: customerId,
        subscription_id: subscriptionId,
        subscription_status: 'active',
        grace_period_end: null,
      }, env);
      if (!ok) throw new Error('profile update failed');

      await sendWelcomeEmail(profile.email, env).catch(() => {});
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const profile = await getProfileByStripeCustomer(sub.customer, env);
      if (!profile) break;
      // Ignore events for an older subscription the customer already replaced.
      if (profile.subscription_id && profile.subscription_id !== sub.id && sub.status !== 'active' && sub.status !== 'trialing') break;

      if (sub.status === 'active' || sub.status === 'trialing') {
        await updateProfile(profile.id, { subscription_status: 'active', subscription_id: sub.id, grace_period_end: null }, env);
      } else if (sub.status === 'past_due') {
        // Don't extend an existing grace window on repeated events.
        const fields = { subscription_status: 'past_due' };
        if (profile.subscription_status !== 'past_due' || !profile.grace_period_end) {
          fields.grace_period_end = new Date(Date.now() + GRACE_MS).toISOString();
        }
        await updateProfile(profile.id, fields, env);
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        await updateProfile(profile.id, { subscription_status: 'cancelled' }, env);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const profile = await getProfileByStripeCustomer(sub.customer, env);
      if (!profile) break;
      if (profile.subscription_id && profile.subscription_id !== sub.id) break;
      await updateProfile(profile.id, { subscription_status: 'cancelled' }, env);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const profile = await getProfileByStripeCustomer(invoice.customer, env);
      if (!profile) break;
      if (profile.subscription_status === 'past_due' && profile.grace_period_end) break;

      await updateProfile(profile.id, {
        subscription_status: 'past_due',
        grace_period_end: new Date(Date.now() + GRACE_MS).toISOString(),
      }, env);
      await sendPaymentFailedEmail(profile.email, env).catch(() => {});
      break;
    }
  }
}
