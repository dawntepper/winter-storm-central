/**
 * County slug helpers — mirrors netlify/functions/lib/alert-matcher.js.
 */

function slugifyCountyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countySlug(name, stateCode) {
  const base = slugifyCountyName(name);
  const st = String(stateCode || '').toLowerCase();
  return base && st ? `${base}-${st}` : base;
}

function citySlug(name, stateCode) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const st = String(stateCode || '').toLowerCase();
  return `${base}-${st}`;
}

module.exports = { slugifyCountyName, countySlug, citySlug };
