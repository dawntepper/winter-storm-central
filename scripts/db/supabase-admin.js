/**
 * Supabase admin client for local seed scripts (service role only).
 */
require('./env');

const { createClient } = require('@supabase/supabase-js');

const SERVICE_KEY_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY_ROLE', // common typo (ROLE/KEY swapped)
  'SUPABASE_SERVICE_KEY',
];

function resolveServiceRoleKey() {
  for (const name of SERVICE_KEY_ENV_NAMES) {
    const value = process.env[name];
    if (value) return { key: value, source: name };
  }
  return { key: null, source: null };
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function validateServiceRoleKey(key, source) {
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (anonKey && key === anonKey) {
    throw new Error(
      `${source} matches VITE_SUPABASE_ANON_KEY. Seed scripts need the service_role secret ` +
        'from Supabase → Project Settings → API (not the anon/public key).',
    );
  }

  const payload = decodeJwtPayload(key);
  if (!payload) {
    throw new Error(
      `${source} is not a valid Supabase JWT (${key.length} chars). ` +
        'Copy the service_role key from Supabase → Project Settings → API. ' +
        `Accepted env names: ${SERVICE_KEY_ENV_NAMES.join(', ')}.`,
    );
  }

  if (payload.role === 'anon') {
    throw new Error(
      `${source} is the anon (public) key — seed scripts require the service_role secret ` +
        'from Supabase → Project Settings → API.',
    );
  }

  if (payload.role !== 'service_role') {
    throw new Error(
      `${source} has JWT role "${payload.role}" — expected service_role for seed scripts.`,
    );
  }

  return key;
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const { key: rawKey, source } = resolveServiceRoleKey();

  if (!url) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL). Add it to .env — see .env.example.',
    );
  }
  if (!rawKey) {
    throw new Error(
      `Missing service role key. Set one of: ${SERVICE_KEY_ENV_NAMES.join(', ')} in .env — see .env.example.`,
    );
  }

  const key = validateServiceRoleKey(rawKey, source);

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { getSupabaseAdmin };
