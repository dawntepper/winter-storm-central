const STORAGE_KEY = 'st_auth_return_path';

/** Safe in-app path only (no open redirects). */
export function sanitizeReturnPath(path) {
  if (!path || typeof path !== 'string') return '/';
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  if (path.startsWith('/auth/')) return '/';
  return path;
}

export function getReturnPathFromSearch(searchParams) {
  const raw = searchParams?.get('redirect') || searchParams?.get('next') || searchParams?.get('returnTo');
  return sanitizeReturnPath(raw);
}

export function stashAuthReturnPath(path) {
  try {
    sessionStorage.setItem(STORAGE_KEY, sanitizeReturnPath(path));
  } catch {
    /* ignore */
  }
}

export function consumeStashedAuthReturnPath() {
  try {
    const path = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return sanitizeReturnPath(path);
  } catch {
    return '/';
  }
}

export function authCallbackUrl(returnPath = '/') {
  const safe = sanitizeReturnPath(returnPath);
  const next = encodeURIComponent(safe);
  return `${window.location.origin}/auth/callback?next=${next}`;
}
