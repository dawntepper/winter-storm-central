import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Magic-link return target (/auth/callback).
 *
 * The Supabase client is configured with detectSessionInUrl: true, so it
 * exchanges the link's tokens for a session automatically; useAuth's
 * onAuthStateChange then flips isAuthenticated. This screen just shows a calm
 * "signing you in" state and redirects home once that resolves.
 */
export default function AuthCallback() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // Success → home shortly; failure/no-session → home after a longer beat.
    const delay = isAuthenticated ? 500 : 2500;
    const t = setTimeout(() => navigate('/', { replace: true }), delay);
    return () => clearTimeout(t);
  }, [loading, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">
      <div className="text-center">
        <div className="text-3xl mb-3">📡</div>
        <p className="text-sm">
          {loading
            ? 'Signing you in…'
            : isAuthenticated
              ? 'Signed in! Redirecting…'
              : 'Finishing up…'}
        </p>
      </div>
    </div>
  );
}
