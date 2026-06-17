import {
  clearAdminSession,
  getAdminPassword,
} from './adminAuth';

const ADMIN_ANALYSIS_API_URL = '/api/admin-analysis-api';

async function parseResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();

  if (!contentType.includes('application/json')) {
    const hint = import.meta.env.DEV
      ? ' Run `netlify dev` so admin-analysis-api is available.'
      : '';
    throw new Error(
      `Admin analysis API returned non-JSON (HTTP ${res.status}).${hint}`
    );
  }

  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Admin analysis API returned invalid JSON (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAdminSession();
      throw new Error(
        json.error || 'Session expired or incorrect password — please log in again.'
      );
    }
    throw new Error(json.error || `Admin analysis API failed (HTTP ${res.status})`);
  }

  return json;
}

/**
 * Fetch read-only analytics for the admin dashboard.
 * @param {'today'|'7d'|'30d'|'all'} dateRange
 */
export async function fetchAdminAnalysis(dateRange = '7d') {
  const password = getAdminPassword();
  if (!password) {
    throw new Error('Admin password required — please log in again.');
  }

  let res;
  try {
    res = await fetch(ADMIN_ANALYSIS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, dateRange, action: 'fetch' }),
    });
  } catch (err) {
    const hint = import.meta.env.DEV
      ? ' Start the functions server with `netlify dev`.'
      : '';
    throw new Error(`Could not reach admin analysis API.${hint} (${err.message})`);
  }

  return parseResponse(res);
}

async function postAdminAnalysis(body) {
  const password = getAdminPassword();
  if (!password) {
    throw new Error('Admin password required — please log in again.');
  }

  let res;
  try {
    res = await fetch(ADMIN_ANALYSIS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, ...body }),
    });
  } catch (err) {
    const hint = import.meta.env.DEV
      ? ' Start the functions server with `netlify dev`.'
      : '';
    throw new Error(`Could not reach admin analysis API.${hint} (${err.message})`);
  }

  return parseResponse(res);
}

/**
 * Generate AI morning brief for a period (server re-fetches aggregated stats).
 * @param {'today'|'yesterday'|'7d'} period
 */
export async function fetchMorningBrief(period) {
  return postAdminAnalysis({
    action: 'morning-brief',
    period,
  });
}

/**
 * Generate AI operations center analysis for a period.
 * @param {'today'|'yesterday'|'7d'} period
 */
export async function fetchOperationsAnalysis(period) {
  return postAdminAnalysis({
    action: 'operations-center',
    period,
  });
}

/**
 * Dismiss a misspelled/invalid missing location search from expansion opportunities.
 */
export async function dismissMissingSearch({ query, stateCode }) {
  return postAdminAnalysis({
    action: 'dismiss-missing-search',
    query,
    stateCode,
  });
}
