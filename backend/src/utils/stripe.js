export async function createPortalSession(customerId, apiKey, returnUrl, configuration) {
  if (!customerId || !apiKey) return null;
  const params = new URLSearchParams({ customer: customerId });
  if (returnUrl) params.set('return_url', returnUrl);
  if (configuration) params.set('configuration', configuration);
  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getSubscription(subscriptionId, apiKey) {
  if (!subscriptionId || !apiKey) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  return res.json();
}
