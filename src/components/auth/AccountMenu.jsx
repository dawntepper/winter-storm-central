import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import SignInModal from './SignInModal';

/**
 * Header account control. Hidden entirely when Supabase isn't configured, so
 * the app degrades to its current anonymous-only behavior with zero UI noise.
 *
 *  - Signed out → "Sign in with email" button that opens the magic-link modal.
 *  - Signed in  → "My Account" + a small dropdown with Sign out.
 *
 * Never gates content — it's a convenience entry point only.
 */
export default function AccountMenu() {
  const { isConfigured, isAuthenticated, user, signOut, initializing } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [open, setOpen] = useState(false);

  if (!isConfigured || initializing) return null;

  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm font-medium transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          title="Sign in with email"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="hidden sm:inline">Sign in with email</span>
        </button>
        {showModal && <SignInModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  const email = user?.email || 'Account';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-sm font-medium transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
        title="My Account"
      >
        <span className="text-base">👤</span>
        <span className="hidden sm:inline">My Account</span>
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-60 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 p-2">
            <div className="px-2 py-1.5 text-xs text-slate-400 truncate">{email}</div>
            <div className="text-[11px] text-emerald-400 px-2 pb-2">
              Saved across your devices ✓
            </div>
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
