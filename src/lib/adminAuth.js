/** Session-scoped admin credentials — cleared when the browser tab closes. */
export const ADMIN_SESSION_KEY = 'admin_authenticated';
export const ADMIN_PASSWORD_KEY = 'admin_password';
export const ADMIN_VALIDATED_KEY = 'admin_session_validated';

export function getAdminPassword() {
  try {
    return sessionStorage.getItem(ADMIN_PASSWORD_KEY) || null;
  } catch {
    return null;
  }
}

export function isSessionValidated() {
  try {
    return sessionStorage.getItem(ADMIN_VALIDATED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function isAdminSessionActive() {
  try {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== 'true') return false;
    if (!sessionStorage.getItem(ADMIN_PASSWORD_KEY)) {
      clearAdminSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function persistAdminSession(password) {
  sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
  sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
}

export function markSessionValidated() {
  sessionStorage.setItem(ADMIN_VALIDATED_KEY, 'true');
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
  sessionStorage.removeItem(ADMIN_VALIDATED_KEY);
}

/** Clear session and notify AdminGate wrappers to show the login form again. */
export function logoutAdmin() {
  clearAdminSession();
  window.dispatchEvent(new CustomEvent('admin-logout'));
}
