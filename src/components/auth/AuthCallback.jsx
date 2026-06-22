import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { finalizeAuthFromUrl } from '../../lib/finalizeAuthFromUrl';
import { getReturnPathFromSearch } from '../../lib/authRedirect';

/**
 * OAuth and email-confirmation return target (/auth/callback).
 *
 * Session finalization also runs globally in useAuth (any route) so misrouted
 * redirects to / still work. This page provides loading UX and error guidance.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('working'); // working | error
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (!supabase) {
        navigate('/', { replace: true });
        return;
      }

      const returnPath = getReturnPathFromSearch(new URLSearchParams(window.location.search));

      const { handled, session, error } = await finalizeAuthFromUrl();

      if (!handled) {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (existing) {
          if (!cancelled) navigate(returnPath, { replace: true });
          return;
        }
        if (!cancelled) {
          setDetail('No sign-in credentials were found in this link. It may have expired or already been used.');
          setStatus('error');
        }
        return;
      }

      if (error || !session) {
        if (!cancelled) {
          setDetail(error?.message || 'Sign-in could not be completed.');
          setStatus('error');
        }
        return;
      }

      if (!cancelled) navigate(returnPath, { replace: true });
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
