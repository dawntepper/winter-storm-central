import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasAccountHint } from '../../lib/accountHint';

/**
 * Magic-link sign-in modal (v1 = passwordless email only). Calm and
 * dismissible — never blocks weather; only opened on user intent.
 *
 * Benefit-focused, not account-focused: weather is always free; signing in just
 * lets your saved locations follow you across devices. Copy softens to a
 * "Welcome back" variant for anyone who's signed in before on this device. The
 * action is "Continue with email" (the magic link both creates and signs in).
 */
export default function SignInModal({ onClose }) {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const returning = hasAccountHint();

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
          <h2 className="text-lg font-bold text-white">
            {returning ? 'Welcome back' : 'Save locations across devices'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {returning ? (
          <p className="text-sm text-slate-400 mb-4">
            Sign in to access your saved locations on any device.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-1">Weather is always free — no account required.</p>
            <p className="text-sm text-slate-400 mb-4">
              Sign in with email to access your saved locations on any device.
            </p>
          </>
        )}

        {status === 'sent' ? (
          <div className="text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-emerald-400 font-medium">📬 Check your email</p>
            <p className="text-slate-300 mt-1">
              We sent a sign-in link{email ? <> to <span className="text-slate-100">{email}</span></> : ''}.
            </p>
            <p className="text-slate-400 mt-2 text-xs">
              Open the link on this device and browser to finish signing in.
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
          </form>
        )}
      </div>
    </div>
  );
}
