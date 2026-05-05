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
async function selectDropdownOption(triggerEl, optionText) {
  triggerEl.click();

  try {
    // AliExpress renders options in a floating list — wait for it to appear.
    // Try common patterns: ul > li, [role="option"], or a visible list container.
    await waitForElement('[class*="select-dropdown"],[class*="SelectDropdown"],[role="listbox"],[class*="country-list"],[class*="CountryList"]', 1500);
  } catch (_) {
    // The list may already be in DOM but hidden — attempt anyway.
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
    return true;
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
    if (refined) { refined.click(); return true; }
  }

  return false;
}

// Finds and sets the country dropdown.
async function fillCountry(countryName) {
  if (!countryName) return;

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

  if (!trigger) return false;
  return await selectDropdownOption(trigger, countryName);
}

// Finds and sets the phone country code dropdown (e.g. "+44").
async function fillPhoneCode(code) {
  if (!code) return;

  const triggers = [
    ...document.querySelectorAll('[role="combobox"],[class*="select-trigger"],[class*="SelectTrigger"],[class*="phone"],[class*="Phone"]'),
    ...document.querySelectorAll('div[class*="select"]'),
  ].filter(el => el.offsetParent !== null);

  const trigger = triggers.find(el => el.textContent.trim().startsWith('+'));
  if (!trigger) return false;
  return await selectDropdownOption(trigger, code);
}

export async function fillForm(addr) {
  const missing = [];

  fillByPlaceholder('input[placeholder^="First name"]',     addr.firstName,  missing);
  fillByPlaceholder('input[placeholder^="Last name"]',      addr.lastName,   missing);
  fillByPlaceholder('input[placeholder*="House number"]',   addr.street,     missing);
  const aptWithCity = [addr.apt, addr.city].filter(Boolean).join(', ');
  fillByPlaceholder('input[placeholder*="Apt"]',            aptWithCity,     missing);
  fillByPlaceholder('input[placeholder="County"]',          addr.county,     missing);
  fillByPlaceholder('input[placeholder^="Postcode"]',       addr.postcode,   missing);
  fillByPlaceholder('input[placeholder^="Mobile number"]',  addr.phoneNumber ? addr.phoneNumber.replace(/\s+/g, '') : addr.phoneNumber, missing);

  // Dropdowns (async — may need to click + wait)
  const countryOk  = await fillCountry(addr.country);
  const phoneOk    = await fillPhoneCode(addr.phoneCountryCode);

  if (!countryOk)  missing.push('country dropdown');
  if (!phoneOk)    missing.push('phone country code dropdown');

  return { missing, warnings: addr.warnings || [] };
}
