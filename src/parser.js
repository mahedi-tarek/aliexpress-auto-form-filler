// Parses a free-text address block into structured fields.
// Supports UK (primary), US, and common European formats.

const KNOWN_COUNTRIES = [
  'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland',
  'United States', 'USA', 'US', 'Canada', 'Australia', 'New Zealand',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Portugal',
  'Austria', 'Switzerland', 'Ireland', 'Japan', 'South Korea', 'Singapore',
  'Malaysia', 'India', 'Brazil', 'Mexico', 'South Africa',
];

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i;
const US_ZIP_RE = /\b(\d{5}(?:-\d{4})?)\b/;
const GENERIC_POSTCODE_RE = /\b(\d{4,6})\b/;
const PHONE_LINE_RE = /^\+?\d[\d\s\-().]{6,}/;
const PHONE_PARSE_RE = /^(\+\d{1,3})\s*(.+)$/;

// Compressed UK postcode (no space), e.g. SE63RS, HA97AJ
const UK_POSTCODE_COMPACT_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/i;

function isJunkToken(token) {
  if (token.length < 6) return false;
  // Colon-separated codes like eCP:TTJDETEG
  if (/^[a-zA-Z\d]+:[a-zA-Z\d]+$/.test(token)) return true;
  // Valid compressed UK postcode — keep it
  if (UK_POSTCODE_COMPACT_RE.test(token)) return false;
  // Mixed letters+digits in one token → tracking/reference junk
  return /[a-zA-Z]/.test(token) && /\d/.test(token);
}

function sanitizeLine(line) {
  return line.split(/\s+/).filter(t => !isJunkToken(t)).join(' ').trim();
}

export function parseAddress(text) {
  const warnings = [];
  let lines = text
    .split(/\r?\n/)
    .map(l => sanitizeLine(l.trim()))
    .filter(Boolean);

  if (lines.length === 0) {
    return { warnings: ['No address text provided'] };
  }

  // --- Extract phone ---
  let phoneCountryCode = '';
  let phoneNumber = '';
  const phoneIdx = lines.findIndex(l => PHONE_LINE_RE.test(l));
  if (phoneIdx !== -1) {
    const phoneLine = lines[phoneIdx];
    lines.splice(phoneIdx, 1);
    const m = phoneLine.match(PHONE_PARSE_RE);
    if (m) {
      phoneCountryCode = m[1];
      phoneNumber = m[2].trim();
    } else {
      phoneNumber = phoneLine.replace(/^\+/, '').trim();
    }
  } else {
    warnings.push('Could not detect phone number');
  }

  // --- Extract country ---
  let country = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i].trim();
    const match = KNOWN_COUNTRIES.find(
      c => c.toLowerCase() === candidate.toLowerCase()
    );
    if (match) {
      country = match === 'UK' ? 'United Kingdom'
               : match === 'USA' || match === 'US' ? 'United States'
               : match;
      lines.splice(i, 1);
      break;
    }
  }
  if (!country) warnings.push('Could not detect country');

  // --- Extract postcode / city / county from a city line ---
  let city = '';
  let county = '';
  let postcode = '';
  let cityLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let pcMatch = l.match(UK_POSTCODE_RE) || l.match(US_ZIP_RE) || l.match(GENERIC_POSTCODE_RE);
    if (pcMatch) {
      postcode = pcMatch[1].toUpperCase();
      const withoutPc = l.replace(pcMatch[0], '').trim().replace(/,\s*$/, '');
      // Split on commas: "Mansfield, Nottinghamshire" or "Springfield, IL"
      const parts = withoutPc.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        city = parts[0];
        county = parts[1];
      } else if (parts.length === 1) {
        city = parts[0];
      }
      cityLineIdx = i;
      break;
    }
  }

  if (cityLineIdx !== -1) {
    lines.splice(cityLineIdx, 1);
  } else {
    warnings.push('Could not detect postcode/city');
  }

  // --- Extract name (first remaining line) ---
  let firstName = '';
  let lastName = '';
  if (lines.length > 0) {
    const nameLine = lines.shift();
    const nameParts = nameLine.split(/\s+/);
    if (nameParts.length === 1) {
      firstName = nameParts[0];
      warnings.push('Only one name token found — check first/last split');
    } else {
      lastName = nameParts[nameParts.length - 1];
      firstName = nameParts.slice(0, -1).join(' ');
    }
  } else {
    warnings.push('Could not detect name');
  }

  // --- Street and apt ---
  let street = lines.shift() || '';
  let apt = lines.join(', ');  // any remaining lines

  return {
    firstName,
    lastName,
    phoneCountryCode,
    phoneNumber,
    street,
    apt,
    city,
    county,
    postcode,
    country,
    warnings,
  };
}
