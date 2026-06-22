/**
 * Authentication Hook
 *
 * Manages user authentication state with Supabase.
 * Provides sign in, sign up, sign out, and session management.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { markAccountKnown } from '../lib/accountHint';
import { authCallbackUrl } from '../lib/authRedirect';
import { finalizeAuthFromUrl } from '../lib/finalizeAuthFromUrl';
import { trackSignIn } from '../utils/analytics';

// Auth context for app-wide access
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 * Wrap your app with this to provide auth state everywhere
 */
export function AuthProvider({ children }) {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from any component
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Internal hook that manages auth state
 */
function useAuthState() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    // Finalize OAuth / email-confirmation tokens on any route, then hydrate session.
    (async () => {
      const { session: urlSession, error: urlError } = await finalizeAuthFromUrl();
      if (urlError) {
        console.error('[Auth] finalizeAuthFromUrl:', urlError);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const active = urlSession || session;
      if (!cancelled) {
        setSession(active);
        setUser(active?.user ?? null);
        if (active?.user) markAccountKnown();
        setInitializing(false);
      }
    })();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setInitializing(false);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          markAccountKnown();
          trackSignIn({ method: session.app_metadata?.provider || 'email' });
          console.log('User signed in:', session?.user?.email);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (email, password, returnPath = '/') => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(returnPath)
      }
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data };
  }, []);

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data };
  }, []);

  /**
   * Sign in with OAuth provider (Google, etc.)
   */
  const signInWithProvider = useCallback(async (provider, returnPath = '/') => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authCallbackUrl(returnPath)
      }
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data };
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setError(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
    }
  }, []);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (email, returnPath = '/') => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(returnPath)
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data, message: 'Check your email for the password reset link!' };
  }, []);

  return {
    user,
    session,
    initializing,
    loading,
    error,
    isAuthenticated: !!user,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword
  };
}

export default useAuth;
