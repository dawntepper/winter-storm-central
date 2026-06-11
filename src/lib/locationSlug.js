/**
 * Slug helpers for the Supabase location catalog.
 * Mirrors scripts/db/lib/slug.js and netlify/functions/lib/alert-matcher.js.
 */

export function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function countySlug(name, stateCode) {
  const base = slugifyName(name);
  const st = String(stateCode || '').toLowerCase();
  return base && st ? `${base}-${st}` : base;
}

export function citySlug(name, stateCode) {
  const base = slugifyName(name);
  const st = String(stateCode || '').toLowerCase();
  return base && st ? `${base}-${st}` : '';
}
