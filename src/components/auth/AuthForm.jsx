import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasAccountHint, getRememberedSignInEmail, rememberSignInEmail } from '../../lib/accountHint';
import { trackSignUpFormSubmitted } from '../../utils/analytics';

const MODES = {
  SIGN_IN: 'signin',
  SIGN_UP: 'signup',
  RESET: 'reset',
};

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * Email/password, Google OAuth, and password reset.
 * Used on /sign-in and optionally in modals.
 */
export default function AuthForm({
  returnPath = '/',
  defaultMode = MODES.SIGN_IN,
  onSuccess,
  compact = false,
}) {
  const { signIn, signUp, signInWithProvider, resetPassword, loading, isConfigured } = useAuth();

  const [mode, setMode] = useState(defaultMode);
  const [email, setEmail] = useState(() => getRememberedSignInEmail());
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const clearFeedback = () => {
    setError('');
    setMessage('');
  };

  const switchMode = (next) => {
    clearFeedback();
    setMode(next);
  };

  const handleGoogle = async () => {
    if (!isConfigured) return;
    clearFeedback();
    const { error: oauthError } = await signInWithProvider('google', returnPath);
    if (oauthError) setError(oauthError.message || 'Google sign-in failed. Please try again.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email.');
      return;
    }

    rememberSignInEmail(trimmedEmail);

    if (mode === MODES.SIGN_IN) {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
      const { data, error: signInError } = await signIn(trimmedEmail, password);
      if (signInError) {
        setError(signInError.message || 'Invalid email or password.');
        return;
      }
      if (data?.session) onSuccess?.({ method: 'password' });
      return;
    }

    if (mode === MODES.SIGN_UP) {
      if (!password) {
        setError('Please choose a password.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      const { data, error: signUpError } = await signUp(trimmedEmail, password, returnPath);
      if (signUpError) {
        setError(signUpError.message || 'Could not create your account.');
        return;
      }
      if (!hasAccountHint()) trackSignUpFormSubmitted({ authMethod: 'password' });
      if (data?.session) {
        onSuccess?.({ method: 'password' });
      } else {
        setMessage('Check your email to confirm your account, then sign in.');
      }
      return;
    }

    if (mode === MODES.RESET) {
      const { error: resetError } = await resetPassword(trimmedEmail, returnPath);
      if (resetError) {
        setError(resetError.message || 'Could not send the reset link.');
        return;
      }
      setMessage('Check your email for a password reset link.');
    }
  };

  if (!isConfigured) {
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-800 p-6 text-center">
        <p className="text-sm text-slate-300 mb-2">Account sign-in is not configured yet.</p>
        <p className="text-xs text-slate-500">
          Add <code className="text-sky-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-sky-300">VITE_SUPABASE_ANON_KEY</code> to enable auth.
        </p>
      </div>
    );
  }

  const showPassword = mode === MODES.SIGN_IN || mode === MODES.SIGN_UP;
  const showOAuth = mode === MODES.SIGN_IN || mode === MODES.SIGN_UP;
  const title =
    mode === MODES.SIGN_UP ? 'Create account' : mode === MODES.RESET ? 'Reset password' : 'Sign in';

  return (
    <div className={compact ? '' : 'rounded-2xl border border-slate-600 bg-slate-800 p-6 sm:p-8 shadow-2xl'}>
      {!compact && (
        <div className="mb-6 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">
            📡
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-slate-400 mt-2">
            Weather is always free — sign in to sync saved locations across devices.
          </p>
        </div>
      )}

      {(mode === MODES.SIGN_IN || mode === MODES.SIGN_UP) && (
        <div className="flex rounded-lg bg-slate-900/80 p-1 mb-5 border border-slate-700">
          <button
            type="button"
            onClick={() => switchMode(MODES.SIGN_IN)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              mode === MODES.SIGN_IN ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode(MODES.SIGN_UP)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
              mode === MODES.SIGN_UP ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create account
          </button>
        </div>
      )}

      {message && (
        <div className="mb-4 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-300">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400">
          {error}
        </div>
      )}

      {showOAuth && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 mb-4 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-500 text-xs">or use email</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="auth-email" className="sr-only">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
          />
        </div>

        {showPassword && (
          <div>
            <label htmlFor="auth-password" className="sr-only">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === MODES.SIGN_UP ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-colors"
        >
          {loading
            ? 'Please wait…'
            : mode === MODES.SIGN_IN
              ? 'Sign in'
              : mode === MODES.SIGN_UP
                ? 'Create account'
                : 'Send reset link'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-700 text-center text-sm space-y-2">
        {mode === MODES.SIGN_IN && (
          <button
            type="button"
            onClick={() => switchMode(MODES.RESET)}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        )}
        {mode === MODES.SIGN_UP && (
          <button
            type="button"
            onClick={() => switchMode(MODES.SIGN_IN)}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Already have an account? <span className="text-sky-400">Sign in</span>
          </button>
        )}
        {mode === MODES.RESET && (
          <button
            type="button"
            onClick={() => switchMode(MODES.SIGN_IN)}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            Back to sign in
          </button>
        )}
      </div>

      {showOAuth && (
        <p className="mt-4 text-center text-xs text-slate-500 leading-relaxed">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      )}

    </div>
  );
}
