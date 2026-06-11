import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  isAdminSessionActive,
  isSessionValidated,
} from '../lib/adminAuth';
import {
  authenticateAdminPassword,
  tryRestoreAdminSession,
} from '../lib/stormsRepo';

/**
 * Wraps an admin page with a password gate. Auth persists in sessionStorage
 * so navigating between /admin, /admin/storms, /admin/seo, /admin/analysis,
 * and /admin/weather-summary does not re-prompt within a browser tab session.
 */
export default function AdminGate({ children }) {
  const [authenticated, setAuthenticated] = useState(
    () => isAdminSessionActive() && isSessionValidated()
  );
  const [checking, setChecking] = useState(
    () => isAdminSessionActive() && !isSessionValidated()
  );

  useEffect(() => {
    const onLogout = () => {
      setAuthenticated(false);
      setChecking(false);
    };
    window.addEventListener('admin-logout', onLogout);
    return () => window.removeEventListener('admin-logout', onLogout);
  }, []);

  useEffect(() => {
    if (!checking) return undefined;

    let cancelled = false;
    (async () => {
      const ok = await tryRestoreAdminSession();
      if (!cancelled) {
        setAuthenticated(ok);
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checking]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-slate-400 text-sm">Checking admin session…</div>
      </div>
    );
  }

  if (authenticated) return children;
  return (
    <PasswordGate
      onAuthenticate={() => {
        setAuthenticated(true);
        setChecking(false);
      }}
    />
  );
}

function PasswordGate({ onAuthenticate }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await authenticateAdminPassword(password);
      onAuthenticate();
    } catch (err) {
      setError(err.message || 'Incorrect password');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-4">Admin Access</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 mb-3"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? 'Checking…' : 'Login'}
          </button>
        </form>
        <Link to="/" className="block text-center mt-4 text-slate-400 text-sm hover:text-white">
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
