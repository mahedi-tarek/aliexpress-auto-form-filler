// Address Filler plans, keyed by Stripe price ID.
//
// The Stripe account is shared with other products, so ONLY these prices may
// change an Address Filler account. Anything else is ignored by the webhook.
export const PLANS = {
  price_1TSRQrDaIo6SglLOCXLsvm6t: { key: 'solo',        name: 'Solo',        seats: 1 },
  price_1Uf7pjDaIo6SglLO4G5zk2hv: { key: 'team',        name: 'Team',        seats: 20 },
  price_1Uf7q8DaIo6SglLOaB6GEJB4: { key: 'agency',      name: 'Agency',      seats: 40 },
  price_1Uf7qdDaIo6SglLOQj52LXtK: { key: 'agency_plus', name: 'Agency Plus', seats: 100 },
};

// Billing-portal configuration that only offers switching between the plans above.
export const PORTAL_CONFIGURATION = 'bpc_1Uf7tPDaIo6SglLOyMTNYshz';

export function planForPrice(priceId) {
  return (priceId && PLANS[priceId]) || null;
}

// Returns the Address Filler plan of a Stripe subscription object, or null if
// none of its items is one of our prices.
export function planForSubscription(sub) {
  const items = sub?.items?.data || [];
  for (const item of items) {
    const plan = planForPrice(item?.price?.id);
    if (plan) return { ...plan, priceId: item.price.id };
  }
  return null;
}
