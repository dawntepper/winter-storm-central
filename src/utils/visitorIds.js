/** Shared anonymous visitor/session IDs (localStorage + sessionStorage). */

export const VISITOR_ID_KEY = 'stormtracking_visitor_id';
export const SESSION_ID_KEY = 'stormtracking_session_id';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateStorageId(storage, key) {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = createId();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Ensure visitor/session IDs exist (used by product_events + visitor_sessions). */
export function getOrCreateVisitorIds() {
  if (typeof window === 'undefined') return null;
  const visitorId = getOrCreateStorageId(localStorage, VISITOR_ID_KEY);
  const sessionId = getOrCreateStorageId(sessionStorage, SESSION_ID_KEY);
  if (!visitorId || !sessionId) return null;
  return { visitorId, sessionId };
}
