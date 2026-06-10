/**
 * Supabase Client Configuration
 *
 * Setup:
 * 1. Create a project at https://supabase.com
 * 2. Copy your project URL and anon key
 * 3. Create a .env file with:
 *    VITE_SUPABASE_URL=your-project-url
 *    VITE_SUPABASE_ANON_KEY=your-anon-key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create client (will be null if not configured)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        // We finalize the session manually in AuthCallback (handles both the
        // implicit #hash and PKCE ?code formats), so disable auto-detect to
        // avoid a double-exchange race with our own handling.
        detectSessionInUrl: false,
        // Implicit flow returns tokens in the URL hash. Magic links opened on
        // mobile frequently land in a DIFFERENT browser/webview than the one
        // that requested them; PKCE would fail there (its code verifier lives
        // in the original browser's storage), whereas hash tokens work anywhere.
        flowType: 'implicit',
      }
    })
  : null;

// Helper to check if we can use Supabase features
export function requireSupabase() {
  if (!supabase) {
    console.warn('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    return false;
  }
  return true;
}

export default supabase;
