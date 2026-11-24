# Chrome Web Store listing: Address Filler for AliExpress

Upload: `store/address-filler-extension.zip` (version 1.1.0)

## Store listing tab

**Name** (comes from the manifest): Address Filler for AliExpress

**Summary** (132 chars max, comes from the manifest):
Paste a copied shipping address into AliExpress checkout forms in one click. 7-day free trial.

**Category:** Shopping
**Language:** English

**Description:**
```
Stop typing shipping addresses into AliExpress one box at a time.

Copy an address from anywhere (an email, a spreadsheet, a chat or an order sheet), open the AliExpress address form and click "Paste & Fill". The extension splits the address into name, street, apartment, city, county, postcode, country and phone number, and fills each field for you.

HOW IT WORKS
1. Copy a full address.
2. On the AliExpress shipping-address form, click the red "Paste & Fill" button.
3. Check or edit the address in the preview box, then click "Fill Form".

FEATURES
• Fills name, street, apartment, city, county, postcode and mobile number
• Picks the country and the phone country code for you
• Handles multi-line and single-line addresses
• Preview and edit before anything is filled
• Move the button to any corner of the screen
• Retry button for dropdowns that didn't take

PRIVACY
Your addresses are processed only inside your browser and are never sent to our servers. The clipboard is read only when you click the button.

PRICING
7-day free trial with no card needed. After that it's $9.99/month through secure Stripe checkout. Cancel anytime from the extension.

Address Filler for AliExpress is an independent tool. It is not affiliated with or endorsed by AliExpress or Alibaba Group.

Support: mhtareqarz@gmail.com
```

**Graphics:**
- Store icon (128×128): `icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-1.png` … `store/screenshot-4.png`
- Small promo tile (440×280): `store/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee-1400x560.png`

**Official URL / Homepage:** https://autoformfiller.xyz
**Support URL:** mailto:mhtareqarz@gmail.com (or https://autoformfiller.xyz)

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
