/**
 * Storms repository — Supabase reads for public + preview access.
 * Admin writes go through netlify/functions/storm-admin-api.js (service role).
 */

import { supabase, isSupabaseConfigured } from './supabase';
import {
  normalizeDbStorm,
  normalizeEmergencySummary,
  normalizeEmergencyEntries
} from './stormNormalize';

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

const ADMIN_SESSION_KEY = 'admin_authenticated';
const ADMIN_PASSWORD_KEY = 'admin_password';

/**
 * Password for storm-admin-api: explicit arg, then session (post-login), then build env.
 */
function getAdminPassword(explicit) {
  if (explicit) return explicit;
  try {
    const stored = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
    if (stored) return stored;
  } catch {
    /* sessionStorage unavailable */
  }
  return import.meta.env.VITE_ADMIN_PASSWORD;
}

/**
 * Validate password against storm-admin-api and persist for subsequent API calls.
 * Falls back to VITE_ADMIN_PASSWORD when functions are unavailable (vite-only dev).
 */
export async function authenticateAdminPassword(password) {
  try {
    await callStormAdminApi('validate', { password });
  } catch (err) {
    const vitePwd = import.meta.env.VITE_ADMIN_PASSWORD;
    if (vitePwd && password === vitePwd) {
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return;
    }
    throw err;
  }
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
}

export function isAdminSessionActive() {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') return false;
  if (!sessionStorage.getItem(ADMIN_PASSWORD_KEY)) {
    clearAdminSession();
    return false;
  }
  return true;
}

export async function callStormAdminApi(action, payload = {}) {
  const body = {
    ...payload,
    action,
    password: getAdminPassword(payload.password)
  };

  const res = await fetch('/.netlify/functions/storm-admin-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Admin API failed (${res.status})`);
  }
  return json;
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
