/**
 * Account-known hint.
 *
 * Magic-link auth can't tell us up front whether an email already has an
 * account (the same link both creates and signs in). So we remember locally
 * once someone has used auth on this device, and use that to choose calmer
 * copy: "Create a free account" for newcomers, "Sign in" for returners.
 *
 * It's only a wording hint — never a gate, and a fresh device simply shows the
 * newcomer copy.
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
