import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasAccountHint } from '../../lib/accountHint';

/**
 * Magic-link sign-in / account-creation modal (v1 = passwordless email only).
 * Calm and dismissible — never blocks weather; only opened on user intent.
 *
 * Copy adapts: newcomers see "Create a free account", returning visitors see
 * "Sign in". With magic links the action is identical (we email a link); only
 * the wording differs so it feels right for each.
 */
export default function SignInModal({ onClose }) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const returning = hasAccountHint();
  const title = returning ? 'Sign in' : 'Create a free account';
  const intro = returning
    ? "Welcome back. We'll email you a one-tap link to sign in — no password needed."
    : "Save your locations so you can get to them on all your devices. No password to create — we'll email you a one-tap link to finish.";
  const submitLabel = returning ? 'Email me a sign-in link' : 'Create my free account';

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
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-400 mb-4">{intro}</p>

        {status === 'sent' ? (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            📬 {message}
            <div className="text-slate-400 mt-1">You can close this window.</div>
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
              {status === 'sending' ? 'Sending…' : submitLabel}
            </button>
          </form>
        )}

        <p className="text-[11px] text-slate-500 mt-3 text-center">
          Weather is always free — no account required.
        </p>
      </div>
    </div>
  );
}
