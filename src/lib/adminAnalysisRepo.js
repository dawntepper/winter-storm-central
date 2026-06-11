const ADMIN_PASSWORD_KEY = 'admin_password';
const ADMIN_ANALYSIS_API_URL = '/api/admin-analysis-api';

function getAdminPassword() {
  try {
    return sessionStorage.getItem(ADMIN_PASSWORD_KEY) || null;
  } catch {
    return null;
  }
}

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
