# Chrome Web Store listing: Address Filler for AliExpress

Upload: `store/address-filler-extension.zip` (version 1.1.0). If you already uploaded an older zip, upload this one again: it has the team plans and the new title.

## Store listing tab

**Name** (from manifest, strongest search field): Address Filler for AliExpress – Dropshipping Address Autofill

**Summary** (from manifest, 132 chars):
Paste any customer address into AliExpress checkout in one click. Autofills name, street, city, ZIP & phone for dropshipping orders.

**Category:** Shopping (alternative: Workflow & Planning)
**Language:** English

**Description** (paste into the Description box):
```
Address Filler for AliExpress is the fastest way to autofill shipping addresses on AliExpress. Copy a customer's address from any order page, email or spreadsheet, click "Paste & Fill" on the AliExpress checkout, and the whole delivery form is filled in seconds.

Built for dropshippers, virtual assistants and fulfillment agencies who place AliExpress orders by hand.

HOW IT WORKS
1. Copy the customer's full address (multi-line or single line).
2. Open the AliExpress shipping address form and click the red "Paste & Fill" button.
3. Check the address in the preview box and click "Fill Form". Done.

WHAT IT FILLS
• First and last name
• Street, house number and apartment
• City, county/state and postcode/ZIP
• Country and phone country code (selected for you)
• Mobile number

WORKS WITH ANY STORE
No store connection needed. Copy addresses from Shopify, eBay, Etsy, TikTok Shop, WooCommerce or Amazon orders, Google Sheets, email or WhatsApp. If you can copy it, you can fill it.

TEAM PLANS FOR VAs AND AGENCIES
One account for your whole team. Each computer that signs in uses one seat, and you can free a seat anytime from the extension.

PRIVATE BY DESIGN
Addresses are processed only inside your browser and are never sent to our servers. The clipboard is read only when you click the button.

PRICING
7-day free trial, no card needed. Then:
• Solo: $9.99/month (1 computer)
• Team: $50/month (20 computers)
• Agency: $90/month (40 computers)
• Agency Plus: $150/month (100 computers)
Secure checkout by Stripe. Change plan or cancel anytime from the extension.

Address Filler for AliExpress is an independent tool. It is not affiliated with or endorsed by AliExpress or Alibaba Group.

Website: https://autoformfiller.xyz
Support: mhtareqarz@gmail.com
```

**Graphics:**
- Store icon (128×128): `store/store-icon-128x128.png`
- Screenshots (1280×800), upload in this order: `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-5.png` (team plans), `store/screenshot-3.png`, `store/screenshot-4.png`
- Small promo tile (440×280): `store/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee-1400x560.png`

**Official URL / Homepage:** https://autoformfiller.xyz
**Support URL:** https://autoformfiller.xyz/#faq

## Privacy tab

**Single purpose:**
Fills the AliExpress shipping-address form from an address the user copied to the clipboard.

**Permission justifications:**
- `clipboardRead`: Reads the address the user copied, only when they click the "Paste & Fill" button, so it can be filled into the AliExpress address form.
- `storage`: Saves the user's sign-in session, button-position preference and a random install ID locally.
- `alarms`: Re-checks the user's trial or subscription status every 15 minutes so access starts or ends on time.
- Host permission `*.aliexpress.com` / `*.aliexpress.us`: Shows the "Paste & Fill" button and fills the address form on AliExpress pages.
- Host permission `tahjkdlttlxgqhoxjqxd.supabase.co`: Account sign-up and sign-in (Supabase authentication).
- Host permission `address-filler-api.mhtareqarz.workers.dev`: Our licensing API, which checks whether the user's free trial or subscription is active.

**Remote code:** No, I am not using remote code. (All JavaScript is in the package; the extension only exchanges JSON data with its API.)

**Data usage, check these:**
- Personally identifiable information (email address, username)
- Authentication information (password at sign-in, session tokens)
- Location → only because a keyed one-way hash of the IP address is stored when a free trial starts (trial abuse prevention). The raw IP is never stored.

Leave all other categories unchecked. Addresses/clipboard data never leave the device.

**Certify all three:**
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://autoformfiller.xyz/privacy.html

## Distribution tab
- Payments: Free (the subscription is billed outside the store, through Stripe)
- Visibility: Public
- Regions: All regions

## Test instructions (for the reviewer)
```
The extension requires a free account. Click the toolbar icon → Sign Up, enter any email, then enter the 6-digit code that arrives by email; the 7-day free trial starts immediately.
Then open any AliExpress product → Buy now → add or edit a shipping address, copy an address such as:
Jane Smith
221 Baker Street, Flat 2
London NW1 6XE
United Kingdom
+44 7700 900123
and click the red "Paste & Fill" button.
```
