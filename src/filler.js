// React-aware form filling helpers for AliExpress address forms.

function setReactInput(el, value) {
  if (!el) return false;
  const proto = el.tagName === 'TEXTAREA'
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur',   { bubbles: true }));
  return true;
}

function fillByPlaceholder(selector, value, missing) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (!el) {
    missing.push(selector);
    return;
  }
  setReactInput(el, value);
}

// AliExpress labels the postcode field differently per country
// ("Postcode", "Postal code", "ZIP code"), so match any of them
// case-insensitively rather than a single exact prefix.
const POSTCODE_SELECTOR =
  'input[placeholder^="Postcode" i],input[placeholder*="postal" i],' +
  'input[placeholder*="zip" i],input[placeholder*="post code" i]';

function normalizePostcode(v) {
  return (v || '').replace(/\s+/g, '').toUpperCase();
}

// Sets the postcode field if present. Whether the value actually stuck is
// verified once at the end of fillForm (a country/phone re-render can clear it),
// so this just attempts the fill — missing-tracking lives in that final check.
function fillPostcode(value) {
  if (!value) return;
  const el = document.querySelector(POSTCODE_SELECTOR);
  if (el) setReactInput(el, value);
}

// Waits for a DOM element matching selector to appear (via MutationObserver).
function waitForElement(selector, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
  });
}

// Clicks the country/phone-code dropdown, waits for options, clicks the match.
// Returns { ok: true } on success or { ok: false, warning: '...' } on failure.
async function selectDropdownOption(triggerEl, optionText) {
  const textBefore = triggerEl.textContent.trim();

  triggerEl.click();

  // Give the dropdown a moment to register the click, then verify it opened.
  await new Promise(r => setTimeout(r, 100));
  const expandedAttr = triggerEl.getAttribute('aria-expanded');
  if (expandedAttr === 'false') {
    // Try once more — some AliExpress variants need a second click.
    triggerEl.click();
    await new Promise(r => setTimeout(r, 150));
  }

  try {
    // Wait for the dropdown list container. Covers class-name, ARIA, and data-role patterns.
    await waitForElement(
      '[class*="select-dropdown"],[class*="SelectDropdown"],[role="listbox"],' +
      '[class*="country-list"],[class*="CountryList"],[aria-haspopup="listbox"],' +
      '[data-role="dropdown"],[aria-expanded="true"]',
      1500
    );
  } catch (_) {
    // The list may already be in DOM but hidden — attempt to find options anyway.
  }

  // Search all visible list items for a text match.
  const candidates = [
    ...document.querySelectorAll('[role="option"], [class*="select-item"], [class*="SelectItem"], [class*="option-item"], li'),
  ].filter(el => el.offsetParent !== null); // only visible elements

  const target = candidates.find(el =>
    el.textContent.trim().toLowerCase() === optionText.toLowerCase()
  );

  if (target) {
    target.click();
    // Wait briefly and verify the trigger's displayed text actually changed.
    await new Promise(r => setTimeout(r, 200));
    const textAfter = triggerEl.textContent.trim();
    if (textAfter === textBefore) {
      return { ok: false, warning: `Dropdown clicked but value did not change (still "${textBefore}")` };
    }
    return { ok: true };
  }

  // If there's a search input inside the dropdown, try typing to narrow results.
  const searchInput = document.querySelector(
    '[class*="select-dropdown"] input,[class*="SelectDropdown"] input,[role="listbox"] input'
  );
  if (searchInput) {
    setReactInput(searchInput, optionText);
    await new Promise(r => setTimeout(r, 400));
    const refined = [...document.querySelectorAll('[role="option"],[class*="select-item"],[class*="SelectItem"]')]
      .filter(el => el.offsetParent !== null)
      .find(el => el.textContent.trim().toLowerCase() === optionText.toLowerCase());
    if (refined) {
      refined.click();
      await new Promise(r => setTimeout(r, 200));
      const textAfter = triggerEl.textContent.trim();
      if (textAfter === textBefore) {
        return { ok: false, warning: `Dropdown clicked but value did not change (still "${textBefore}")` };
      }
      return { ok: true };
    }
  }

  return { ok: false };
}

// Finds and sets the country dropdown.
async function fillCountry(countryName) {
  if (!countryName) return { ok: true }; // nothing to do

  // Locate the dropdown trigger — look for an element currently showing a country name
  // or one with role="combobox" near the county/postcode row.
  const triggers = [
    ...document.querySelectorAll('[role="combobox"],[class*="select-trigger"],[class*="SelectTrigger"],[class*="country-select"],[class*="CountrySelect"]'),
    ...document.querySelectorAll('div[class*="select"]'),
  ].filter(el => el.offsetParent !== null);

  // Prefer a trigger whose text looks like a country (not a phone code).
  const trigger = triggers.find(el => {
    const t = el.textContent.trim();
    return t.length > 2 && !t.startsWith('+') && !/^\d/.test(t);
  });

  if (!trigger) return { ok: false };
  return await selectDropdownOption(trigger, countryName);
}

// Finds and sets the phone country code dropdown (e.g. "+44").
async function fillPhoneCode(code) {
  if (!code) return { ok: true }; // nothing to do

  const triggers = [
    ...document.querySelectorAll('[role="combobox"],[class*="select-trigger"],[class*="SelectTrigger"],[class*="phone"],[class*="Phone"]'),
    ...document.querySelectorAll('div[class*="select"]'),
  ].filter(el => el.offsetParent !== null);

  const trigger = triggers.find(el => el.textContent.trim().startsWith('+'));
  if (!trigger) return { ok: false };
  return await selectDropdownOption(trigger, code);
}

// Any one of these means the AliExpress address form has rendered.
const FORM_READY_SELECTOR =
  'input[placeholder^="First name"],input[placeholder*="House number"],' +
  POSTCODE_SELECTOR;

export async function fillForm(addr) {
  const missing  = [];
  const warnings = [...(addr.warnings || [])];

  // The button can be clicked before AliExpress's form has rendered (it now
  // appears the moment the page loads). Wait briefly for the form so an early
  // click can't "miss". If it never shows, fall through — the missing-field
  // tracking below will report what couldn't be filled.
  try {
    await waitForElement(FORM_READY_SELECTOR, 6000);
  } catch (_) {
    warnings.push('Address form did not appear — open the AliExpress address page, then try again');
  }

  // Select the country FIRST. AliExpress re-renders the address fields when the
  // country changes (postcode/county labels and validation are country-specific),
  // which wipes any values set beforehand — this was why the postcode often
  // failed to "catch". Setting country first means the text fields below land in
  // the final, settled form.
  const countryResult = await fillCountry(addr.country);

  fillByPlaceholder('input[placeholder^="First name"]',     addr.firstName,  missing);
  fillByPlaceholder('input[placeholder^="Last name"]',      addr.lastName,   missing);
  fillByPlaceholder('input[placeholder*="House number"]',   addr.street,     missing);
  const aptWithCity = [addr.apt, addr.city].filter(Boolean).join(', ');
  fillByPlaceholder('input[placeholder*="Apt"]',            aptWithCity,     missing);
  fillByPlaceholder('input[placeholder="County"]',          addr.county,     missing);
  fillPostcode(addr.postcode);
  fillByPlaceholder('input[placeholder^="Mobile number"]',  addr.phoneNumber ? addr.phoneNumber.replace(/\s+/g, '') : addr.phoneNumber, missing);

  const phoneResult = await fillPhoneCode(addr.phoneCountryCode);

  // Final safety net + verification: the country/phone re-render can clear the
  // postcode, so confirm it actually holds the expected value and re-apply once
  // if not. This is the single source of truth for whether postcode is missing.
  if (addr.postcode) {
    const pc = document.querySelector(POSTCODE_SELECTOR);
    if (!pc) {
      missing.push('postcode');
    } else if (normalizePostcode(pc.value) !== normalizePostcode(addr.postcode)) {
      setReactInput(pc, addr.postcode);
      if (normalizePostcode(pc.value) !== normalizePostcode(addr.postcode)) {
        missing.push('postcode');
      }
    }
  }

  if (!countryResult.ok) {
    missing.push('country dropdown');
    if (countryResult.warning) warnings.push(countryResult.warning);
  }
  if (!phoneResult.ok) {
    missing.push('phone country code dropdown');
    if (phoneResult.warning) warnings.push(phoneResult.warning);
  }

  return { missing, warnings };
}
