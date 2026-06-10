/**
 * Account-known hint.
 *
 * Magic-link auth can't tell us up front whether an email already has an
 * account (the same link both creates and signs in). We remember locally once
 * someone has completed sign-in on this device and use that to gate analytics
 * (Sign Up Form Submitted) — not UI copy, which is always unified "Sign In".
 *
 * Never a feature gate. Set only after a successful Supabase session (not on magic-
 * link request alone). Persists across sign-out and is independent of whether
 * the account still exists server-side — clear `st_account_known` in devtools
 * to reset the copy during testing.
 */
const KEY = 'st_account_known';

export function markAccountKnown() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasAccountHint() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Dev/testing helper — not used in normal sign-out flow. */
export function clearAccountHint() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
