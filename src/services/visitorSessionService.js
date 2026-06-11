/**
 * Durable visitor session tracking (Supabase) + Plausible dashboard events.
 * Runs once per browser session; no PII; anon client only.
 */

import { supabase } from '../lib/supabase';
import {
  trackVisitorSessionStarted,
  trackReturningVisitor,
  detectSourceFromReferrer,
} from '../utils/analytics';

const VISITOR_ID_KEY = 'stormtracking_visitor_id';
const SESSION_ID_KEY = 'stormtracking_session_id';
const SESSION_REGISTERED_KEY = 'stormtracking_session_registered';
const SESSION_ROW_ID_KEY = 'stormtracking_session_row_id';

const HEARTBEAT_DEBOUNCE_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 60_000;

let heartbeatTimer = null;
let heartbeatInterval = null;
let listenersBound = false;
/** Dedupes concurrent init (e.g. React StrictMode double-mount). */
let initPromise = null;

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateStorageId(storage, key) {
  let id = storage.getItem(key);
  if (!id) {
    id = createId();
    storage.setItem(key, id);
  }
  return id;
}

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

async function checkIsReturning(visitorId) {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_returning_visitor', {
    p_visitor_id: visitorId,
  });
  if (error) {
    console.warn('visitor session returning check:', error.message);
    return false;
  }
  return Boolean(data);
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
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('visitor_sessions')
    .insert({
      visitor_id: visitorId,
      session_id: sessionId,
      landing_page: landingPage,
      referrer,
      source,
      device_type: deviceType,
      is_returning: isReturning,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('visitor session insert:', error.message);
    return null;
  }
  return data?.id ?? null;
}

async function pulseLastSeen() {
  const rowId = sessionStorage.getItem(SESSION_ROW_ID_KEY);
  if (!rowId || !supabase) return;

  const { error } = await supabase
    .from('visitor_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', rowId);

  if (error) console.warn('visitor session heartbeat:', error.message);
}

function scheduleHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(() => {
    pulseLastSeen().catch(() => {});
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
    pulseLastSeen().catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
}

export function startVisitorSessionHeartbeat() {
  if (!sessionStorage.getItem(SESSION_ROW_ID_KEY)) return;
  bindHeartbeatListeners();
  scheduleHeartbeat();
}

async function registerVisitorSessionOnce() {
  const visitorId = getOrCreateStorageId(localStorage, VISITOR_ID_KEY);
  const sessionId = getOrCreateStorageId(sessionStorage, SESSION_ID_KEY);
  const landingPage = getLandingPage();
  const referrer = getReferrer();
  const source = parseSource();
  const deviceType = getDeviceType();

  const isReturning = await checkIsReturning(visitorId);
  const rowId = await insertVisitorSession({
    visitorId,
    sessionId,
    isReturning,
    landingPage,
    referrer,
    source,
    deviceType,
  });

  sessionStorage.setItem(SESSION_REGISTERED_KEY, '1');
  if (rowId) sessionStorage.setItem(SESSION_ROW_ID_KEY, rowId);

  const visitorType = isReturning ? 'returning' : 'new';
  trackVisitorSessionStarted({
    visitorType,
    source,
    landingPage,
  });

  if (isReturning) {
    trackReturningVisitor({ source, landingPage });
  }
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
