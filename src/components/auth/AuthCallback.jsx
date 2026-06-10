import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

/**
 * Magic-link return target (/auth/callback).
 *
 * Finalizes the session deterministically rather than relying on
 * detectSessionInUrl (which races our own handling). Supports BOTH callback
 * formats:
 *   - implicit  →  #access_token=…&refresh_token=…   (our default; mobile-safe)
 *   - pkce      →  ?code=…                            (defensive fallback)
 *
 * On success → home. On failure → a real error screen with guidance, never a
 * blank sign-in form. Weather is never gated by any of this.
 *
 * NOTE: the console.log lines are temporary debugging for the mobile magic-link
 * investigation — remove once confirmed stable in production.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('working'); // working | error
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const href = window.location.href;
      const search = window.location.search;
      const hash = window.location.hash;
      // --- temporary debug ---
      console.log('[AuthCallback] full URL:', href);
      console.log('[AuthCallback] search params:', search);
      console.log('[AuthCallback] hash params:', hash);

      // Auth not configured → don't block anything, just go to weather.
      if (!supabase) {
        navigate('/', { replace: true });
        return;
      }

      const search$ = new URLSearchParams(search);
      const hash$ = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const code = search$.get('code');
      const accessToken = hash$.get('access_token');
      const refreshToken = hash$.get('refresh_token');
      const errorDescription =
        search$.get('error_description') || hash$.get('error_description');

      try {
        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        }

        if (accessToken && refreshToken) {
          // Implicit flow — establish the session straight from the hash tokens.
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          console.log('[AuthCallback] setSession (implicit):', {
            hasSession: !!data?.session,
            error,
          });
          if (error) throw error;
        } else if (code) {
          // PKCE fallback — exchange the code (needs the verifier from THIS
          // browser; will fail if the link was opened in a different one).
          const { data, error } = await supabase.auth.exchangeCodeForSession(href);
          console.log('[AuthCallback] exchangeCodeForSession (pkce):', {
            hasSession: !!data?.session,
            error,
          });
          if (error) throw error;
        }

        const {
          data: { session },
          error: sessErr,
        } = await supabase.auth.getSession();
        console.log('[AuthCallback] getSession after finalize:', {
          hasSession: !!session,
          sessErr,
        });
        if (sessErr) throw sessErr;
        if (!session) {
          throw new Error(
            'No session was created. Please open the sign-in link on the same device and browser where you requested it.'
          );
        }

        if (!cancelled) navigate('/', { replace: true });
      } catch (e) {
        console.error('[AuthCallback] sign-in failed:', e);
        if (!cancelled) {
          setDetail(e?.message || 'Sign-in could not be completed.');
          setStatus('error');
        }
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200 p-6">
        <div className="text-center max-w-sm">
          <div className="text-3xl mb-3">📡</div>
          <h1 className="text-lg font-semibold mb-2">Couldn&apos;t finish signing in</h1>
          <p className="text-sm text-slate-400 mb-4">{detail}</p>
          <p className="text-xs text-slate-500 mb-4">
            Tip: open the link on the same device and browser where you requested it.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold cursor-pointer transition-colors"
          >
            Back to weather
          </button>
          <p className="text-[11px] text-slate-500 mt-3">
            Weather is always free — no account required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">
      <div className="text-center">
        <div className="text-3xl mb-3">📡</div>
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
