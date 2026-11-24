# Meta ads playbook: Address Filler for AliExpress

All images are in `marketing/meta-ads/`. Every ad links to **https://autoformfiller.xyz/**, not straight to the Chrome Web Store, so the Meta Pixel can see visits (see "Before you spend" below).

## Strategy in one paragraph
This is a niche B2B-ish tool. Cold audiences are small, so do not optimize for installs straight away (Meta can't see Chrome Web Store installs). Use three angles. **(A) Pain → relief** sells to solo dropshippers. **(B) Agency/VA** sells the high-value plans. **(C) Engagement** buys cheap reach and comments, which builds a warm audience (people who engaged or watched) that you retarget with A and B. Agencies are worth more than 5 solo users each ($50–$150/mo vs $9.99), so give angle B a fair share of budget even though its clicks cost more.

## Campaign structure (starting budget about $20–30/day)
| Campaign | Objective | Audience | Ads | Budget |
|---|---|---|---|---|
| 1. Engagement / warm-up | Engagement (post engagement) | Broad: interests "Dropshipping", "Shopify", "AliExpress", "E-commerce"; age 20–45; English-speaking countries + PH, PK, IN, BD (VA markets) | C1 quiz, C2 before/after | 20% |
| 2. Sales: solo sellers | Traffic → landing page views (switch to Leads/Conversions once the Pixel has 50+ events/week) | Same interests, excluding VA-only countries; Advantage+ audience on | A1, A45, A916 | 45% |
| 3. Sales: agencies | Traffic → landing page views | Interests "Virtual assistant", "Dropshipping", "Shopify Plus", "Upwork", job titles "E-commerce manager / Operations manager"; plus retargeting of campaign 1 engagers | B1, B45 | 35% |
| 4. Retargeting (after 7 days) | Traffic | Website visitors 30d, video/post engagers 30d, excluding people who clicked "Add to Chrome" | A + B, best performer | Move 15% here |

Kill rule: after about $15 spend per ad, pause anything with a link CTR under 0.8% or CPC above 2× the campaign average. Double the budget on winners by no more than 20%/day.

---

## Angle A: Pain → relief (sales)
**Images:** `A-pain-1080x1080.png` (feed), `A-pain-1080x1350.png` (feed 4:5, best on mobile), `A-pain-1080x1920-story.png` (Stories/Reels)
**CTA button:** Learn More (or Download)

**Primary text, version 1 (short)**
> Still typing customer addresses into AliExpress, one box at a time? 😩
> Copy the address → click Paste & Fill → done. Name, street, city, ZIP and phone filled in 3 seconds.
> Try it free for 7 days. No card needed.

**Primary text, version 2 (story)**
> I used to spend 3 minutes on every AliExpress order: copy name, paste, copy street, paste, fix the postcode, pick the country, find the phone code…
> Now I copy the whole address once and click one button. Every field is filled.
> ✅ Works with Shopify, eBay, Etsy, TikTok Shop and WooCommerce orders
> ✅ Preview and edit before it fills
> ✅ Addresses never leave your browser
> Free for 7 days 👉 autoformfiller.xyz

**Primary text, version 3 (numbers)**
> 30 orders a day × 3 minutes = 1.5 hours of typing addresses.
> Address Filler for AliExpress turns that into about 2 minutes. One click per order.
> Start your 7-day free trial.

**Headlines (A/B test):** "Fill AliExpress orders in 1 click" · "Stop typing addresses" · "AliExpress address autofill"
**Description:** "Free 7-day trial · Chrome extension"

## Angle B: Agencies & VA teams (sales)
**Images:** `B-agency-1080x1080.png`, `B-agency-1080x1350.png`

**Primary text, version 1**
> Running a dropshipping agency or a VA team?
> Give every VA one-click AliExpress address autofill, all on one account with one bill.
> 👥 20 computers: $50/mo
> 👥 40 computers: $90/mo
> 👥 100 computers: $1.50 each
> Fewer typos, faster fulfillment, happier clients. Start with a 7-day free trial.

**Primary text, version 2 (ROI)**
> Your VAs fill hundreds of AliExpress addresses a week. Every typo is a lost parcel and a refund.
> Address Filler pastes the full address into AliExpress checkout in one click, so there's nothing to mistype.
> Team plans from $2.50 per computer. Add or swap computers anytime from the extension.

**Headlines:** "Built for dropshipping VA teams" · "From $1.50 per computer" · "One account. 100 computers."
**Description:** "Team plans · 7-day free trial"

## Angle C: Engagement (reach + warm audience)
**C1, quiz:** `C-engagement-quiz-1080x1080.png`
> Be honest 👇 How long does ONE AliExpress order take you?
> A) Under 30 seconds
> B) 1–2 minutes
> C) 3+ minutes (typing addresses 😩)
> Comment your letter. We'll reply with the trick that gets you to A.

*Reply to every comment.* For B and C: "Try Address Filler: copy the address, one click fills AliExpress. Free 7 days: autoformfiller.xyz". Replies boost reach and teach Meta who your audience is.

**C2, before/after:** `C-before-after-1080x1080.png`
> Before: 3 minutes per order, field by field.
> After: 3 seconds. Copy → Paste & Fill → done.
> Tag a dropshipper who still types addresses by hand 😅

**Also post organically** (free) in Facebook groups for dropshipping and VAs, following each group's rules. The quiz format works well there.

---

## Before you spend: tracking
1. **Meta Pixel:** create one in Events Manager and send me the Pixel ID. I'll add it to the website with two events: `PageView` and a custom `AddToChrome` fired when someone clicks any "Add to Chrome" button. Then optimize for `AddToChrome`.
2. **UTM links:** use `https://autoformfiller.xyz/?utm_source=meta&utm_medium=paid&utm_campaign=<A|B|C>&utm_content=<adname>`.
3. **Domain verification** for autoformfiller.xyz in Meta Business Settings (needed for link ads and conversion events).

## Ad policy notes (so ads don't get rejected)
- Don't use AliExpress's logo or say "official". The images use only our icon and say "for AliExpress".
- Avoid "you" + personal attributes ("Are you broke?"). The copy above follows this.
- Claims stay factual: "3 seconds" is how long a fill takes, and "3 minutes" is the typical manual time reported by fulfillment tools.
