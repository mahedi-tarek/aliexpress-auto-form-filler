// Plans shown in the popup. Payment links are public Stripe URLs; the server
// decides what each plan unlocks from the Stripe price, never from this file.
export const PLANS = [
  { key: 'solo',        name: 'Solo',        seats: 1,   price: 9.99, link: 'https://buy.stripe.com/00wfZh00rfTGatS7KN0x201' },
  { key: 'team',        name: 'Team',        seats: 20,  price: 50,   link: 'https://buy.stripe.com/6oU4gz28z6j6atSd570x202' },
  { key: 'agency',      name: 'Agency',      seats: 40,  price: 90,   link: 'https://buy.stripe.com/aFa6oH6oP5f2fOc2qt0x203' },
  { key: 'agency_plus', name: 'Agency Plus', seats: 100, price: 150,  link: 'https://buy.stripe.com/aFa7sL3cD36UgSgfdf0x204' },
];

export function planByKey(key) {
  return PLANS.find(p => p.key === key) || null;
}
