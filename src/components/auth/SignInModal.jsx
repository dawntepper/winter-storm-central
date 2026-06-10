import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { hasAccountHint } from '../../lib/accountHint';

/**
 * Passwordless sign-in modal — two steps, both in THIS window:
 *   1. Enter email → we send a 6-digit code.
 *   2. Enter the code → verifyOtp signs you in right here.
 *
 * Using a code (not a magic link) is what makes mobile reliable: the session
 * lands in the same browser the user is already in, instead of an email app's
 * isolated in-app browser. Calm, dismissible, benefit-focused — never blocks
 * weather. Softens to a "Welcome back" variant for returning visitors.
 */
export default function SignInModal({ onClose }) {
  const { signInWithMagicLink, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // email | code
  const [status, setStatus] = useState('idle'); // idle | sending | verifying | error
  const [message, setMessage] = useState('');
  const returning = hasAccountHint();

  const sendCode = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setStatus('error');
      setMessage('Please enter your email.');
      return;
    }
    setStatus('sending');
    setMessage('');
    const { error } = await signInWithMagicLink(trimmed);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'Could not send the code. Please try again.');
    } else {
      setStep('code');
      setStatus('idle');
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setStatus('error');
      setMessage('Enter the 6-digit code from your email.');
      return;
    }
    setStatus('verifying');
    setMessage('');
    const { error } = await verifyEmailOtp(email.trim(), trimmed);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'That code didn’t work — double-check it and try again.');
    } else {
      onClose(); // signed in; onAuthStateChange updates the rest of the UI
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

        {step === 'email' ? (
          <>
            {returning ? (
              <p className="text-sm text-slate-400 mb-4">
                Sign in to access your saved locations on any device.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-300 mb-1">
                  Weather is always free — no account required.
                </p>
                <p className="text-sm text-slate-400 mb-4">
                  Sign in with email to access your saved locations on any device.
                </p>
              </>
            )}

            <form onSubmit={sendCode}>
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
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-1">
              Enter the 6-digit code we emailed to{' '}
              <span className="text-slate-100">{email}</span>.
            </p>
            <p className="text-xs text-slate-500 mb-4">
              The code finishes sign-in right here — no need to leave this window.
            </p>

            <form onSubmit={verifyCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 mb-3 text-center text-lg tracking-[0.4em] font-semibold"
              />
              {status === 'error' && <p className="text-xs text-red-400 mb-2">{message}</p>}
              <button
                type="submit"
                disabled={status === 'verifying'}
                className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                {status === 'verifying' ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-3 text-xs">
              <button
                onClick={() => { setStep('email'); setCode(''); setStatus('idle'); setMessage(''); }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ← Use a different email
              </button>
              <button
                onClick={sendCode}
                disabled={status === 'sending'}
                className="text-sky-400 hover:text-sky-300 cursor-pointer disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
