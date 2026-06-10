/**
 * Finalize Supabase auth when the browser lands with tokens in the URL.
 *
 * detectSessionInUrl is disabled on the client to avoid racing AuthCallback;
 * we call this explicitly instead. Must run on ANY route — magic links only
 * work if they hit /auth/callback, but misconfigured redirects often land on /.
 */

import { supabase } from './supabase';

function parseAuthParams() {
  const search$ = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const hash$ = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return {
    code: search$.get('code'),
    accessToken: hash$.get('access_token'),
    refreshToken: hash$.get('refresh_token'),
    errorDescription: search$.get('error_description') || hash$.get('error_description'),
  };
}

/** Strip auth tokens / codes from the address bar after a successful exchange. */
export function clearAuthParamsFromUrl() {
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    /* ignore */
  }
}

/**
 * If the current URL carries Supabase auth callback params, establish the
 * session and clean the URL. No-op when there is nothing to process.
 *
 * @returns {Promise<{ handled: boolean, session: import('@supabase/supabase-js').Session | null, error: Error | null }>}
 */
export async function finalizeAuthFromUrl() {
  if (!supabase || typeof window === 'undefined') {
    return { handled: false, session: null, error: null };
  }

  const { code, accessToken, refreshToken, errorDescription } = parseAuthParams();
  if (!code && !accessToken && !errorDescription) {
    return { handled: false, session: null, error: null };
  }

  try {
    if (errorDescription) {
      throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
    }

    let session = null;

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      session = data.session;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) throw error;
      session = data.session;
    }

    if (!session) {
      const { data: { session: stored } } = await supabase.auth.getSession();
      session = stored;
    }

    if (!session) {
      throw new Error(
        'No session was created. Please open the sign-in link on the same device and browser where you requested it.'
      );
    }

    clearAuthParamsFromUrl();
    return { handled: true, session, error: null };
  } catch (error) {
    return { handled: true, session: null, error };
  }
}
