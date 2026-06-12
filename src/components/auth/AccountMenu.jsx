import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import SignInModal from './SignInModal';

const UTILITY_TRIGGER_CLASS =
  'inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer';

function AccountIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

/**
 * Header account control. Hidden entirely when Supabase isn't configured, so
 * the app degrades to its current anonymous-only behavior with zero UI noise.
 *
 *  - Signed out → "Sign in" on headerTop row (isolated from nav chips).
 *  - Signed in  → utility-row control next to "Updated" (homepage) or headerTop fallback.
 *
 * Never gates content — it's a convenience entry point only.
 *
 * @param {'headerTop' | 'utility'} placement
 *   headerTop — sign-in link row 1 when signed out; optional signed-in fallback
 *   utility   — account control in homepage utility row (signed in only)
 * @param {boolean} [showSignedInFallback]
 *   When true with headerTop, render signed-in account on row 1 (pages without utility row).
 */
export default function AccountMenu({ placement = 'utility', showSignedInFallback = false }) {
  const { isConfigured, isAuthenticated, user, signOut, initializing } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  if (!isConfigured || initializing) return null;

  if (!isAuthenticated) {
    if (placement !== 'headerTop') return null;
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs sm:text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Sign in with email"
        >
          Sign in
        </button>
        {showModal && <SignInModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  const showInUtility = placement === 'utility';
  const showInHeaderTop = placement === 'headerTop' && showSignedInFallback;
  if (!showInUtility && !showInHeaderTop) return null;

  const email = user?.email || 'Account';

  const handleSignOut = () => {
    setOpen(false);
    void signOut();
  };

  return (
    <div className={`relative ${open ? 'z-[1100]' : ''}`}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        className={UTILITY_TRIGGER_CLASS}
        title="Account"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AccountIcon />
        Account
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2"
        >
          <div className="px-2 py-1.5 text-xs text-slate-400 truncate">{email}</div>
          <div className="text-[11px] text-emerald-400 px-2 pb-2">
            Saved across your devices ✓
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
