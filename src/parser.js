// Parses a free-text address block into structured fields.
// Supports UK (primary), US, and common international formats.

const KNOWN_COUNTRIES = [
  // British Isles
  'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Ireland',
  // North America
  'United States', 'USA', 'US', 'Canada', 'Mexico',
  // Oceania
  'Australia', 'New Zealand',
  // Western Europe
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland',
  'Austria', 'Portugal', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Luxembourg',
  'Iceland', 'Liechtenstein', 'Monaco', 'San Marino', 'Vatican City', 'Malta', 'Cyprus',
  // Eastern / Central Europe
  'Poland', 'Czech Republic', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria',
  'Croatia', 'Slovenia', 'Serbia', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia',
  'Albania', 'Kosovo', 'Moldova', 'Ukraine', 'Belarus', 'Lithuania', 'Latvia', 'Estonia',
  // Russia & CIS
  'Russia', 'Russian Federation', 'Kazakhstan', 'Uzbekistan', 'Azerbaijan', 'Georgia',
  'Armenia', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan',
  // Middle East
  'Turkey', 'Israel', 'Saudi Arabia', 'United Arab Emirates', 'UAE', 'Qatar', 'Kuwait',
  'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Iraq', 'Iran', 'Yemen', 'Syria', 'Palestine',
  // South Asia
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Maldives',
  // East Asia
  'Japan', 'South Korea', 'Korea', 'China', 'Taiwan', 'Hong Kong', 'Macau', 'Mongolia',
  // Southeast Asia
  'Singapore', 'Malaysia', 'Thailand', 'Vietnam', 'Indonesia', 'Philippines',
  'Cambodia', 'Myanmar', 'Laos', 'Brunei', 'East Timor', 'Timor-Leste',
  // Central Asia / Other Asia
  'Afghanistan',
  // Africa
  'South Africa', 'Nigeria', 'Kenya', 'Egypt', 'Morocco', 'Algeria', 'Tunisia',
  'Ghana', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'Senegal', 'Ivory Coast',
  "Côte d'Ivoire", 'Cameroon', 'Zimbabwe', 'Zambia', 'Mozambique', 'Angola',
  'Namibia', 'Botswana', 'Madagascar', 'Mauritius', 'Libya', 'Sudan', 'Somalia',
  'Democratic Republic of the Congo', 'Congo', 'Republic of the Congo',
  // Latin America
  'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador',
  'Bolivia', 'Paraguay', 'Uruguay', 'Cuba', 'Dominican Republic', 'Puerto Rico',
  'Costa Rica', 'Panama', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
  'Jamaica', 'Trinidad and Tobago', 'Barbados', 'Haiti',
  // Pacific
  'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga', 'Vanuatu',
  // Others commonly seen in AliExpress orders
  'Greece', 'Romania', 'Serbia', 'Croatia',
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

// Returns true if a line looks like a real person's name.
// Rejects lines that are likely order numbers, references, store names, or labels.
function looksLikeName(line) {
  if (!line || line.length < 2) return false;
  if (/\d/.test(line)) return false;                         // contains digits → ref/order
  if (/^(order|ref|#|invoice|from:|to:|attn:|attention:)/i.test(line)) return false;
  if (line === line.toUpperCase() && line.replace(/\s/g, '').length > 3) return false; // ALL CAPS → brand/store
  return true;
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
               : match === 'UAE' ? 'United Arab Emirates'
               : match === 'Korea' ? 'South Korea'
               : match;
      lines.splice(i, 1);
      break;
    }
  }

  // Fuzzy fallback: if the last line looks like a country name (all alpha/spaces,
  // not matched above) treat it as the country with a warning.
  if (!country && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (/^[A-Za-z\s\-']{3,}$/.test(lastLine) && !/^\d/.test(lastLine)) {
      country = lastLine;
      lines.pop();
      warnings.push(`Country "${country}" was guessed — please verify it is correct`);
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
      // Split on commas: "Mansfield, Nottinghamshire" or
      // "Manchester, Denton, Greater Manchester". When there are multiple
      // location parts, everything except the last goes to the first field
      // (city) and the last part goes to the county field.
      const parts = withoutPc.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        city = parts.slice(0, -1).join(', ');
        county = parts[parts.length - 1];
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

  // --- Extract name (first line that looks like a real person's name) ---
  let firstName = '';
  let lastName = '';

  if (lines.length > 0) {
    let nameLineIdx = 0;

    // If the first line doesn't look like a name but the second does, skip
    // the first (likely an order number, reference, or store name).
    if (!looksLikeName(lines[0]) && lines.length > 1 && looksLikeName(lines[1])) {
      warnings.push(`First line "${lines[0]}" skipped — does not look like a name`);
      nameLineIdx = 1;
    }

    const nameLine = lines.splice(nameLineIdx, 1)[0];
    const nameParts = nameLine.split(/\s+/);
    if (nameParts.length === 1) {
      firstName = nameParts[0];
      warnings.push('Only one name token found — check first/last split');
    } else {
      lastName  = nameParts[nameParts.length - 1];
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
