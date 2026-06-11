/**
 * Storms repository — Supabase reads for public + preview access.
 * Admin writes go through netlify/functions/storm-admin-api.js (service role).
 */

import { supabase, isSupabaseConfigured } from './supabase';
import {
  clearAdminSession,
  getAdminPassword,
  isAdminSessionActive,
  isSessionValidated,
  markSessionValidated,
  persistAdminSession,
} from './adminAuth';
import {
  normalizeDbStorm,
  normalizeEmergencySummary,
  normalizeEmergencyEntries
} from './stormNormalize';

export {
  clearAdminSession,
  isAdminSessionActive,
} from './adminAuth';

async function fetchEmergencyData(stormId) {
  if (!supabase || !stormId) {
    return { summary: null, entries: [] };
  }

  const [summaryRes, entriesRes] = await Promise.all([
    supabase
      .from('storm_emergency_summary')
      .select('*')
      .eq('storm_id', stormId)
      .maybeSingle(),
    supabase
      .from('storm_emergency_info')
      .select('*')
      .eq('storm_id', stormId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  ]);

  if (summaryRes.error) {
    console.warn('storm_emergency_summary fetch:', summaryRes.error.message);
  }
  if (entriesRes.error) {
    console.warn('storm_emergency_info fetch:', entriesRes.error.message);
  }

  return {
    summary: summaryRes.data || null,
    entries: entriesRes.data || []
  };
}

export function isStormsDbEnabled() {
  return isSupabaseConfigured;
}

/**
 * List live storms from Supabase (public RLS).
 * @returns {Promise<{ data: object[], error: Error|null }>}
 */
export async function listLiveStormsFromDb() {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('storms')
    .select('*')
    .eq('status', 'live')
    .order('start_date', { ascending: true });

  if (error) return { data: [], error };

  const storms = await Promise.all(
    (data || []).map(async (row) => {
      const { summary, entries } = await fetchEmergencyData(row.id);
      return normalizeDbStorm(row, summary, entries);
    })
  );

  return { data: storms.filter(Boolean), error: null };
}

/**
 * Fetch a single live storm by slug.
 */
export async function getLiveStormBySlugFromDb(slug) {
  if (!supabase || !slug) return { data: null, error: null };

  const { data: row, error } = await supabase
    .from('storms')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'live')
    .maybeSingle();

  if (error) return { data: null, error };
  if (!row) return { data: null, error: null };

  const { summary, entries } = await fetchEmergencyData(row.id);
  return { data: normalizeDbStorm(row, summary, entries), error: null };
}

/**
 * Preview draft/preview storms via RPC + preview token.
 */
export async function getPreviewStormBySlug(slug, previewToken) {
  if (!supabase || !slug || !previewToken) {
    return { data: null, error: 'Preview token required' };
  }

  const { data, error } = await supabase.rpc('get_storm_preview_by_token', {
    p_slug: slug,
    p_token: previewToken
  });

  if (error) return { data: null, error };
  if (!data?.storm) return { data: null, error: 'Preview not found' };

  const normalized = normalizeDbStorm(
    data.storm,
    data.emergency_summary,
    data.emergency_info || []
  );

  return { data: normalized, error: null };
}

/** Netlify redirect: /api/* → /.netlify/functions/* (see netlify.toml). */
const STORM_ADMIN_API_URL = '/api/storm-admin-api';

function resolveAdminPassword(explicit) {
  if (explicit) return explicit;
  return getAdminPassword();
}

async function parseAdminApiResponse(res, action) {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();

  if (!contentType.includes('application/json')) {
    const hint = import.meta.env.DEV
      ? ' Run `netlify dev` (not `npm run dev` alone) so storm-admin-api is available.'
      : '';
    throw new Error(
      `Storm admin API returned non-JSON (HTTP ${res.status}).${hint}`
    );
  }

  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Storm admin API returned invalid JSON (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAdminSession();
      throw new Error(
        json.error || 'Session expired or incorrect password — please log in again.'
      );
    }
    throw new Error(json.error || `Admin API failed (HTTP ${res.status})`);
  }

  if (action === 'validate' && json.ok !== true) {
    throw new Error('Admin password validation failed — please log in again.');
  }

  return json;
}

/**
 * Validate password against storm-admin-api and persist for subsequent API calls.
 */
export async function authenticateAdminPassword(password) {
  await callStormAdminApi('validate', { password });
  persistAdminSession(password);
  markSessionValidated();
}

/**
 * Re-use a stored password within the tab session. Validates against the API
 * once per session; subsequent admin routes trust sessionStorage until logout.
 */
export async function tryRestoreAdminSession() {
  if (!isAdminSessionActive()) return false;
  if (isSessionValidated()) return true;

  try {
    await callStormAdminApi('validate');
    markSessionValidated();
    return true;
  } catch {
    clearAdminSession();
    return false;
  }
}

export async function callStormAdminApi(action, payload = {}) {
  const password = resolveAdminPassword(payload.password);
  if (!password) {
    throw new Error('Admin password required — please log in again.');
  }

  const body = {
    ...payload,
    action,
    password
  };

  let res;
  try {
    res = await fetch(STORM_ADMIN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    const hint = import.meta.env.DEV
      ? ' Start the functions server with `netlify dev`.'
      : '';
    throw new Error(`Could not reach storm admin API.${hint} (${err.message})`);
  }

  return parseAdminApiResponse(res, action);
}

export async function listAllStormsFromAdminApi(adminPassword) {
  const result = await callStormAdminApi('list', { password: adminPassword });
  const storms = (result.data || []).map((row) =>
    normalizeDbStorm(row.storm, row.emergency_summary, row.emergency_info || [])
  );
  return { data: storms, error: null };
}

export async function saveStormToDb(formData, adminPassword, adminStatus = 'draft') {
  return callStormAdminApi('save', {
    password: adminPassword,
    formData,
    adminStatus,
    existingId: formData.dbId || null
  });
}

export async function getStormFromAdminApi(slug) {
  const result = await callStormAdminApi('get', { slug });
  if (!result.data?.storm) return { data: null, error: null };
  return {
    data: normalizeDbStorm(
      result.data.storm,
      result.data.emergency_summary,
      result.data.emergency_info || []
    ),
    error: null
  };
}

export async function publishStormToDb(slug, adminPassword) {
  return callStormAdminApi('publish', { password: adminPassword, slug });
}

export async function archiveStormInDb(slug, adminPassword) {
  return callStormAdminApi('archive', { password: adminPassword, slug });
}

export async function previewStormInDb(slug, adminPassword) {
  return callStormAdminApi('preview', { password: adminPassword, slug });
}

export async function triggerBuildHook() {
  const hookUrl = import.meta.env.VITE_NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    console.warn('VITE_NETLIFY_BUILD_HOOK_URL not set — skipping build hook');
    return { triggered: false };
  }
  await fetch(hookUrl, { method: 'POST' });
  return { triggered: true };
}
