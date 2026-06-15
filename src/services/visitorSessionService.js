/**
 * Durable visitor session tracking (Supabase) + Plausible dashboard events.
 * Runs once per browser session; no PII; anon client only.
 */

import { supabase } from '../lib/supabase';
import {
  getOrCreateVisitorIds,
  SESSION_ID_KEY,
} from '../utils/visitorIds';
import {
  trackVisitorSessionStarted,
  trackReturningVisitor,
  detectSourceFromReferrer,
} from '../utils/analytics';

const SESSION_REGISTERED_KEY = 'stormtracking_session_registered';
/** Set after first successful insert — avoids RPC round-trip before insert (bounce loss). */
const PRIOR_SESSION_KEY = 'stormtracking_has_prior_session';

const HEARTBEAT_DEBOUNCE_MS = 30_000;
const INSERT_RETRY_MS = 500;
const HEARTBEAT_INTERVAL_MS = 60_000;

let heartbeatTimer = null;
let heartbeatInterval = null;
let listenersBound = false;
/** Dedupes concurrent init (e.g. React StrictMode double-mount). */
let initPromise = null;

function getDeviceType() {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  if (window.innerWidth < 768) return 'mobile';
  return 'desktop';
}

function parseSource() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) return utmSource.trim().slice(0, 120);
  } catch {
    // ignore
  }
  const fromReferrer = detectSourceFromReferrer();
  return fromReferrer || null;
}

function getLandingPage() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

function getReferrer() {
  if (typeof document === 'undefined') return null;
  const ref = document.referrer;
  return ref ? ref.slice(0, 500) : null;
}

/** Local returning check — must not block insert on a network round-trip. */
function checkIsReturningLocal() {
  try {
    return localStorage.getItem(PRIOR_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markPriorSession() {
  try {
    localStorage.setItem(PRIOR_SESSION_KEY, '1');
  } catch {
    // ignore — insert already succeeded
  }
}

async function insertVisitorSession({
  visitorId,
  sessionId,
  isReturning,
  landingPage,
  referrer,
  source,
  deviceType,
}) {
  if (!supabase) return false;
  // No .select() — anon has INSERT but not SELECT RLS; RETURNING would fail.
  const { error } = await supabase.from('visitor_sessions').insert({
    visitor_id: visitorId,
    session_id: sessionId,
    landing_page: landingPage,
    referrer,
    source,
    device_type: deviceType,
    is_returning: isReturning,
  });

  if (error) {
    console.warn('visitor session insert:', error.message);
    return false;
  }

  if (import.meta.env.DEV) {
    console.log('[visitorSession] inserted', {
      visitorId: visitorId.slice(0, 8),
      sessionId: sessionId.slice(0, 8),
      isReturning,
    });
  }

  return true;
}

async function insertVisitorSessionWithRetry(payload) {
  if (await insertVisitorSession(payload)) return true;
  await new Promise((resolve) => setTimeout(resolve, INSERT_RETRY_MS));
  return insertVisitorSession(payload);
}

/** Update last_seen for the current browser session (session_id scoped). */
export async function pulseVisitorSessionLastSeen() {
  const sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId || !supabase) return;

  const { error } = await supabase
    .from('visitor_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('session_id', sessionId);

  if (error) console.warn('visitor session heartbeat:', error.message);
}

function scheduleHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(() => {
    pulseVisitorSessionLastSeen().catch(() => {});
  }, HEARTBEAT_DEBOUNCE_MS);
}

function bindHeartbeatListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  const onActivity = () => scheduleHeartbeat();

  window.addEventListener('focus', onActivity);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onActivity();
  });

  heartbeatInterval = setInterval(() => {
    pulseVisitorSessionLastSeen().catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
}

export function startVisitorSessionHeartbeat() {
  if (!sessionStorage.getItem(SESSION_REGISTERED_KEY)) return;
  bindHeartbeatListeners();
  scheduleHeartbeat();
}

async function registerVisitorSessionOnce() {
  const ids = getOrCreateVisitorIds();
  if (!ids) return false;

  const { visitorId, sessionId } = ids;
  const landingPage = getLandingPage();
  const referrer = getReferrer();
  const source = parseSource();
  const deviceType = getDeviceType();

  const isReturning = checkIsReturningLocal();
  const inserted = await insertVisitorSessionWithRetry({
    visitorId,
    sessionId,
    isReturning,
    landingPage,
    referrer,
    source,
    deviceType,
  });

  if (!inserted) return false;

  markPriorSession();
  sessionStorage.setItem(SESSION_REGISTERED_KEY, '1');

  const visitorType = isReturning ? 'returning' : 'new';
  trackVisitorSessionStarted({
    visitorType,
    source,
    landingPage,
  });

  if (isReturning) {
    trackReturningVisitor({ source, landingPage });
  }

  return true;
}

/**
 * Register this browser session once: Supabase insert + Plausible events.
 * Safe to call on every route mount — sessionStorage guard prevents duplicates.
 */
export async function initVisitorSession() {
  if (typeof window === 'undefined') return;

  if (sessionStorage.getItem(SESSION_REGISTERED_KEY)) {
    startVisitorSessionHeartbeat();
    return;
  }

  if (!initPromise) {
    initPromise = registerVisitorSessionOnce().finally(() => {
      initPromise = null;
    });
  }

  try {
    await initPromise;
  } catch {
    // Analytics must not break the app; allow retry on next mount.
  }

  startVisitorSessionHeartbeat();
}

export function stopVisitorSessionHeartbeat() {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
