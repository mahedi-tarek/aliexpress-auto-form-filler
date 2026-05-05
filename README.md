# AliExpress Address Filler — Chrome Extension

Autofills the AliExpress delivery form from an address you've copied to your clipboard.

## How to install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `AliExpress-Address-Filler` folder
5. Done — the extension is now active

## How to use

1. Copy an address anywhere (eBay order, email, spreadsheet, etc.)
2. Open AliExpress and go to the address / checkout form
3. Click the red **📋 Fill address** button (bottom-right corner of the page)
4. Allow clipboard access if Chrome asks (one-time prompt)
5. All fields are filled instantly

## Supported address format

The parser handles UK addresses primarily, plus US/EU best-effort:

```
First Last
Street address
Apt / extra line (optional)
City, County POSTCODE
Country
+CountryCode PhoneNumber
```

**Example:**
```
cristian constantin
16 Second Avenue
Forest Town ebayzr7rt3d
Mansfield, Nottinghamshire NG19 0BG
United Kingdom
+44 7818 330060
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Button doesn't appear | Reload the AliExpress page after installing the extension |
| Country dropdown not set | Open DevTools on the page, inspect the country dropdown element, and update the selector in `filler.js → fillCountry()` |
| Phone code not set | Same — inspect the phone code element and update `filler.js → fillPhoneCode()` |
| Fields cleared after filling | AliExpress re-rendered — click the button again |
| Toast says "missing: …" | That field's placeholder text changed — update the selector in `filler.js` |

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (Manifest V3) |
| `parser.js` | Converts raw address text → structured object |
| `filler.js` | React-aware helpers to fill each form field |
| `content.js` | Injects the floating button and wires everything together |
| `styles.css` | Button and toast styles |
| `icons/` | Extension icons |
