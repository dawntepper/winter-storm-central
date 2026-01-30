/**
 * State Configuration — single source of truth for all US state data.
 * Used by state alert pages, components, and helper functions.
 */

import { STATE_CENTROIDS } from './stateCentroids';

// =============================================
// US_STATES — keyed by URL slug
// =============================================

export const US_STATES = {
  'alabama':        { name: 'Alabama',        abbr: 'AL', center: [32.81, -86.79], zoom: 7,  fipsCode: '01' },
  'alaska':         { name: 'Alaska',          abbr: 'AK', center: [64.0,  -152.0], zoom: 4,  fipsCode: '02' },
  'arizona':        { name: 'Arizona',         abbr: 'AZ', center: [34.27, -111.66], zoom: 7, fipsCode: '04' },
  'arkansas':       { name: 'Arkansas',        abbr: 'AR', center: [34.97, -92.37], zoom: 7,  fipsCode: '05' },
  'california':     { name: 'California',      abbr: 'CA', center: [37.27, -119.27], zoom: 6, fipsCode: '06' },
  'colorado':       { name: 'Colorado',        abbr: 'CO', center: [39.0,  -105.55], zoom: 7, fipsCode: '08' },
  'connecticut':    { name: 'Connecticut',     abbr: 'CT', center: [41.6,  -72.7],  zoom: 8,  fipsCode: '09' },
  'delaware':       { name: 'Delaware',        abbr: 'DE', center: [39.0,  -75.5],  zoom: 8,  fipsCode: '10' },
  'florida':        { name: 'Florida',         abbr: 'FL', center: [28.5,  -82.5],  zoom: 6,  fipsCode: '12' },
  'georgia':        { name: 'Georgia',         abbr: 'GA', center: [32.68, -83.5],  zoom: 7,  fipsCode: '13' },
  'hawaii':         { name: 'Hawaii',          abbr: 'HI', center: [20.5,  -157.0], zoom: 7,  fipsCode: '15' },
  'idaho':          { name: 'Idaho',           abbr: 'ID', center: [44.5,  -114.36], zoom: 6, fipsCode: '16' },
  'illinois':       { name: 'Illinois',        abbr: 'IL', center: [40.0,  -89.0],  zoom: 7,  fipsCode: '17' },
  'indiana':        { name: 'Indiana',         abbr: 'IN', center: [40.0,  -86.27], zoom: 7,  fipsCode: '18' },
  'iowa':           { name: 'Iowa',            abbr: 'IA', center: [42.03, -93.48], zoom: 7,  fipsCode: '19' },
  'kansas':         { name: 'Kansas',          abbr: 'KS', center: [38.5,  -98.0],  zoom: 7,  fipsCode: '20' },
  'kentucky':       { name: 'Kentucky',        abbr: 'KY', center: [37.84, -84.27], zoom: 7,  fipsCode: '21' },
  'louisiana':      { name: 'Louisiana',       abbr: 'LA', center: [31.0,  -92.0],  zoom: 7,  fipsCode: '22' },
  'maine':          { name: 'Maine',           abbr: 'ME', center: [45.37, -69.24], zoom: 7,  fipsCode: '23' },
  'maryland':       { name: 'Maryland',        abbr: 'MD', center: [39.05, -76.8],  zoom: 8,  fipsCode: '24' },
  'massachusetts':  { name: 'Massachusetts',   abbr: 'MA', center: [42.23, -71.83], zoom: 8,  fipsCode: '25' },
  'michigan':       { name: 'Michigan',        abbr: 'MI', center: [44.35, -85.6],  zoom: 6,  fipsCode: '26' },
  'minnesota':      { name: 'Minnesota',       abbr: 'MN', center: [46.28, -94.31], zoom: 6,  fipsCode: '27' },
  'mississippi':    { name: 'Mississippi',      abbr: 'MS', center: [33.0,  -89.9],  zoom: 7,  fipsCode: '28' },
  'missouri':       { name: 'Missouri',        abbr: 'MO', center: [38.35, -92.46], zoom: 7,  fipsCode: '29' },
  'montana':        { name: 'Montana',         abbr: 'MT', center: [47.05, -109.63], zoom: 6, fipsCode: '30' },
  'nebraska':       { name: 'Nebraska',        abbr: 'NE', center: [41.5,  -99.8],  zoom: 7,  fipsCode: '31' },
  'nevada':         { name: 'Nevada',          abbr: 'NV', center: [39.3,  -116.75], zoom: 6, fipsCode: '32' },
  'new-hampshire':  { name: 'New Hampshire',   abbr: 'NH', center: [43.68, -71.58], zoom: 8,  fipsCode: '33' },
  'new-jersey':     { name: 'New Jersey',      abbr: 'NJ', center: [40.19, -74.67], zoom: 8,  fipsCode: '34' },
  'new-mexico':     { name: 'New Mexico',      abbr: 'NM', center: [34.52, -106.25], zoom: 7, fipsCode: '35' },
  'new-york':       { name: 'New York',        abbr: 'NY', center: [43.0,  -75.5],  zoom: 7,  fipsCode: '36' },
  'north-carolina': { name: 'North Carolina',  abbr: 'NC', center: [35.56, -79.39], zoom: 7,  fipsCode: '37' },
  'north-dakota':   { name: 'North Dakota',    abbr: 'ND', center: [47.45, -100.47], zoom: 7, fipsCode: '38' },
  'ohio':           { name: 'Ohio',            abbr: 'OH', center: [40.42, -82.91], zoom: 7,  fipsCode: '39' },
  'oklahoma':       { name: 'Oklahoma',        abbr: 'OK', center: [35.47, -97.52], zoom: 7,  fipsCode: '40' },
  'oregon':         { name: 'Oregon',          abbr: 'OR', center: [44.0,  -120.5], zoom: 7,  fipsCode: '41' },
  'pennsylvania':   { name: 'Pennsylvania',    abbr: 'PA', center: [41.2,  -77.19], zoom: 7,  fipsCode: '42' },
  'rhode-island':   { name: 'Rhode Island',    abbr: 'RI', center: [41.68, -71.51], zoom: 9,  fipsCode: '44' },
  'south-carolina': { name: 'South Carolina',  abbr: 'SC', center: [34.0,  -81.03], zoom: 7,  fipsCode: '45' },
  'south-dakota':   { name: 'South Dakota',    abbr: 'SD', center: [44.3,  -100.35], zoom: 7, fipsCode: '46' },
  'tennessee':      { name: 'Tennessee',       abbr: 'TN', center: [35.75, -86.25], zoom: 7,  fipsCode: '47' },
  'texas':          { name: 'Texas',           abbr: 'TX', center: [31.5,  -99.56], zoom: 5,  fipsCode: '48' },
  'utah':           { name: 'Utah',            abbr: 'UT', center: [39.32, -111.67], zoom: 7, fipsCode: '49' },
  'vermont':        { name: 'Vermont',         abbr: 'VT', center: [44.07, -72.67], zoom: 8,  fipsCode: '50' },
  'virginia':       { name: 'Virginia',        abbr: 'VA', center: [37.54, -78.99], zoom: 7,  fipsCode: '51' },
  'washington':     { name: 'Washington',      abbr: 'WA', center: [47.38, -120.45], zoom: 7, fipsCode: '53' },
  'west-virginia':  { name: 'West Virginia',   abbr: 'WV', center: [38.64, -80.62], zoom: 7,  fipsCode: '54' },
  'wisconsin':      { name: 'Wisconsin',       abbr: 'WI', center: [44.63, -89.71], zoom: 7,  fipsCode: '55' },
  'wyoming':        { name: 'Wyoming',         abbr: 'WY', center: [43.0,  -107.55], zoom: 7, fipsCode: '56' },
};

// =============================================
// DERIVED LOOKUP TABLES
// =============================================

// Abbreviation → slug: { NY: 'new-york', ... }
export const ABBR_TO_SLUG = {};
// Slug → abbreviation: { 'new-york': 'NY', ... }
export const SLUG_TO_ABBR = {};
// Abbreviation → full name: { NY: 'New York', ... }
export const STATE_NAMES = {};

for (const [slug, state] of Object.entries(US_STATES)) {
  ABBR_TO_SLUG[state.abbr] = slug;
  SLUG_TO_ABBR[slug] = state.abbr;
  STATE_NAMES[state.abbr] = state.name;
}
// DC isn't a state but appears in NWS alert data
STATE_NAMES['DC'] = 'Washington D.C.';

// =============================================
// NEARBY STATES (geographic adjacency)
// =============================================

export const NEARBY_STATES = {
  AL: ['MS', 'TN', 'GA', 'FL'],
  AK: ['WA', 'HI'],
  AZ: ['NM', 'UT', 'NV', 'CA', 'CO'],
  AR: ['MO', 'TN', 'MS', 'LA', 'TX', 'OK'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'UT'],
  CT: ['NY', 'MA', 'RI'],
  DE: ['MD', 'PA', 'NJ'],
  FL: ['GA', 'AL'],
  GA: ['FL', 'AL', 'TN', 'NC', 'SC'],
  HI: ['AK', 'CA'],
  ID: ['MT', 'WY', 'UT', 'NV', 'OR', 'WA'],
  IL: ['WI', 'IA', 'MO', 'KY', 'IN'],
  IN: ['IL', 'MI', 'OH', 'KY'],
  IA: ['MN', 'WI', 'IL', 'MO', 'NE', 'SD'],
  KS: ['NE', 'MO', 'OK', 'CO'],
  KY: ['IN', 'OH', 'WV', 'VA', 'TN', 'MO', 'IL'],
  LA: ['TX', 'AR', 'MS'],
  ME: ['NH', 'VT', 'MA'],
  MD: ['PA', 'DE', 'VA', 'WV'],
  MA: ['NH', 'VT', 'NY', 'CT', 'RI'],
  MI: ['WI', 'IN', 'OH'],
  MN: ['WI', 'IA', 'SD', 'ND'],
  MS: ['AL', 'TN', 'AR', 'LA'],
  MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
  MT: ['ND', 'SD', 'WY', 'ID'],
  NE: ['SD', 'IA', 'MO', 'KS', 'CO', 'WY'],
  NV: ['OR', 'ID', 'UT', 'AZ', 'CA'],
  NH: ['ME', 'VT', 'MA'],
  NJ: ['NY', 'PA', 'DE'],
  NM: ['CO', 'OK', 'TX', 'AZ', 'UT'],
  NY: ['VT', 'MA', 'CT', 'NJ', 'PA'],
  NC: ['VA', 'TN', 'GA', 'SC'],
  ND: ['MN', 'SD', 'MT'],
  OH: ['MI', 'IN', 'KY', 'WV', 'PA'],
  OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
  OR: ['WA', 'ID', 'NV', 'CA'],
  PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
  RI: ['CT', 'MA'],
  SC: ['NC', 'GA'],
  SD: ['ND', 'MN', 'IA', 'NE', 'WY', 'MT'],
  TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
  TX: ['NM', 'OK', 'AR', 'LA'],
  UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
  VT: ['NH', 'MA', 'NY'],
  VA: ['MD', 'WV', 'KY', 'TN', 'NC'],
  WA: ['OR', 'ID'],
  WV: ['PA', 'MD', 'VA', 'KY', 'OH'],
  WI: ['MN', 'IA', 'IL', 'MI'],
  WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID'],
};

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get state data by URL slug.
 * Returns { name, abbr, center, zoom, fipsCode } or null.
 */
export function getStateBySlug(slug) {
  return US_STATES[slug] || null;
}

/**
 * Get the /alerts/... URL for a state abbreviation.
 */
export function getStateUrl(abbr) {
  const slug = ABBR_TO_SLUG[abbr];
  return slug ? `/alerts/${slug}` : null;
}

/**
 * Get all state slugs as an array (sorted alphabetically by name).
 */
export function getAllStateSlugs() {
  return Object.keys(US_STATES);
}
