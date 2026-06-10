import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasAccountHint } from '../../lib/accountHint';
import { trackSignUpFormSubmitted, setNavSource, NAV_SOURCES } from '../../utils/analytics';

/**
 * Magic-link sign-in modal (v1 = passwordless email only). Calm and
 * dismissible — never blocks weather; only opened on user intent.
 *
 * Unified "Sign In" copy — the magic link both creates and signs in. Analytics
 * still gates Sign Up Form Submitted on !hasAccountHint() for first-time intent.
 */
export default function SignInModal({ onClose }) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus('sending');
    const { error, message: msg } = await signInWithMagicLink(trimmed);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'Something went wrong. Please try again.');
    } else {
      setStatus('sent');
      setMessage(msg || 'Check your email for the login link!');
      if (!hasAccountHint()) trackSignUpFormSubmitted();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Sign In</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-1">Weather is always free — no account required.</p>
        <p className="text-sm text-slate-400 mb-4">
          Sign in with email to save your locations across devices.
        </p>

        {status === 'sent' ? (
          <div className="text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-emerald-400 font-medium">📬 Check your email</p>
            <p className="text-slate-300 mt-1">
              We sent a sign-in link{email ? <> to <span className="text-slate-100">{email}</span></> : ''}.
            </p>
            <p className="text-slate-400 mt-2 text-xs">
              Open the link on this device and browser to finish signing in.
            </p>
            <p className="text-slate-500 mt-1.5 text-xs">
              Not in your inbox? Check spam or junk.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 mb-3"
            />
            {status === 'error' && <p className="text-xs text-red-400 mb-2">{message}</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
            >
              {status === 'sending' ? 'Sending…' : 'Continue with email'}
            </button>
            {isMobile && (
              <p className="mt-3 text-center text-xs text-slate-500">
                <Link
                  to="/add-to-home"
                  onClick={() => {
                    setNavSource(NAV_SOURCES.SIGN_IN_MODAL);
                    onClose();
                  }}
                  className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                >
                  Add StormTracking to your home screen
                </Link>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
