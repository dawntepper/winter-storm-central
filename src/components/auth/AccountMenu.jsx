import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import SignInModal from './SignInModal';

/** Matches homepage header nav chips (Live Alerts, Radar, State dropdown). */
const NAV_CHIP_CLASS =
  'text-xs sm:text-sm text-slate-400 hover:bg-slate-500/25 font-medium bg-slate-500/15 px-2.5 py-1 rounded border border-slate-500/30 transition-colors';

/**
 * Header account control. Hidden entirely when Supabase isn't configured, so
 * the app degrades to its current anonymous-only behavior with zero UI noise.
 *
 *  - Signed out → "Sign in" on headerTop row (isolated from nav chips).
 *  - Signed in  → "Account" nav chip on nav row + dropdown with Sign out.
 *
 * Never gates content — it's a convenience entry point only.
 *
 * @param {'headerTop' | 'nav'} placement
 *   headerTop — sign-in link, top-right row 1 (signed out only)
 *   nav       — account chip, last item in nav row 2 (signed in only)
 */
export default function AccountMenu({ placement = 'nav' }) {
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

  if (placement !== 'nav') return null;

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
        className={`${NAV_CHIP_CLASS} cursor-pointer`}
        title="Account"
        aria-expanded={open}
        aria-haspopup="menu"
      >
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
