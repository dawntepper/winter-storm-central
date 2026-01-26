/**
 * Authentication Hook
 *
 * Manages user authentication state with Supabase.
 * Provides sign in, sign up, sign out, and session management.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle specific events
        if (event === 'SIGNED_IN') {
          console.log('User signed in:', session?.user?.email);
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (email, password) => {
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
        emailRedirectTo: `${window.location.origin}/auth/callback`
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
   * Sign in with magic link (passwordless)
   */
  const signInWithMagicLink = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return { error };
    }

    return { data, message: 'Check your email for the login link!' };
  }, []);

  /**
   * Sign in with OAuth provider (Google, etc.)
   */
  const signInWithProvider = useCallback(async (provider) => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
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
  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      setError('Authentication not configured');
      return { error: { message: 'Authentication not configured' } };
    }

    setError(null);

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
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
    loading,
    error,
    isAuthenticated: !!user,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signInWithMagicLink,
    signInWithProvider,
    signOut,
    resetPassword
  };
}

export default useAuth;
