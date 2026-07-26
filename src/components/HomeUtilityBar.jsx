import { useEffect, useRef, useState } from 'react';
import { trackShare, trackManualRefresh } from '../utils/analytics';
import { useAuth } from '../hooks/useAuth';
import AccountMenu from './auth/AccountMenu';
import ContactLink from './ContactLink';

function UtilitySeparator() {
  return <span aria-hidden="true" className="text-slate-600">•</span>;
}

/**
 * Homepage utility controls.
 *
 * mode:
 *  - 'full' (default): Updated · Refresh · Share · Support (desktop) / More on mobile
 *  - 'status': Updated · Refresh only (compact header status line)
 *  - 'more': quiet More overflow for Share/Support
 */
export default function HomeUtilityBar({
  lastRefresh,
  onRefresh,
  loading,
  isStale,
  mode = 'full',
  className = '',
}) {
  const [shareMessage, setShareMessage] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const moreTriggerRef = useRef(null);
  const { isConfigured, isAuthenticated, initializing } = useAuth();
  const showAccount = mode === 'full' && isConfigured && !initializing && isAuthenticated;

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (e) => {
      if (moreRef.current?.contains(e.target) || moreTriggerRef.current?.contains(e.target)) return;
      setMoreOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const handleShare = async () => {
    const shareData = {
      title: 'StormTracking - Real-Time Extreme Weather Alerts',
      text: 'Track extreme weather alerts in real-time. Live updates on winter storms, hurricanes, and severe weather from the National Weather Service.',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        trackShare('native');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
        trackShare('clipboard');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
        trackShare('clipboard');
      }
    } finally {
      setMoreOpen(false);
    }
  };

  const handleRefresh = () => {
    trackManualRefresh();
    onRefresh?.();
  };

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const hasContentBeforeShare = Boolean(lastRefresh || showAccount || onRefresh);

  const shareControl = (
    <span className="relative">
      <button
        type="button"
        onClick={handleShare}
        className="whitespace-nowrap text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        Share
      </button>
      {shareMessage && (
        <span className="absolute right-0 top-full mt-0.5 text-[10px] text-emerald-400 whitespace-nowrap">
          {shareMessage}
        </span>
      )}
    </span>
  );

  const supportControl = (
    <ContactLink className="whitespace-nowrap text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
      Support
    </ContactLink>
  );

  const moreMenu = (
    <span className="relative inline-flex items-center">
      <button
        ref={moreTriggerRef}
        type="button"
        onClick={() => setMoreOpen((o) => !o)}
        className="whitespace-nowrap text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-xs font-medium"
        aria-expanded={moreOpen}
        aria-haspopup="menu"
      >
        More
      </button>
      {moreOpen && (
        <div
          ref={moreRef}
          role="menu"
          className="absolute right-0 top-full mt-1 min-w-[8.5rem] rounded-lg border border-slate-600 bg-slate-800 shadow-xl z-50 py-1"
        >
          <div role="menuitem" className="px-3 py-2">
            {shareControl}
          </div>
          <div role="menuitem" className="px-3 py-2 border-t border-slate-700/80">
            {supportControl}
          </div>
        </div>
      )}
    </span>
  );

  if (mode === 'more') {
    return (
      <div className={`inline-flex items-center shrink-0 ${className}`.trim()}>
        {moreMenu}
      </div>
    );
  }

  if (mode === 'status') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-500 max-w-full ${className}`.trim()}>
        {lastRefresh && (
          <span className="whitespace-nowrap">
            Updated {formatTime(lastRefresh)}
            {isStale && <span className="text-amber-400/90 ml-1">(cached)</span>}
          </span>
        )}
        {onRefresh && (
          <>
            {lastRefresh && <UtilitySeparator />}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="whitespace-nowrap text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs text-slate-500 max-w-full ${className}`.trim()}>
      {lastRefresh && (
        <span className="whitespace-nowrap">
          Updated {formatTime(lastRefresh)}
          {isStale && <span className="text-amber-400/90 ml-1">(cached)</span>}
        </span>
      )}
      {showAccount && (
        <>
          {lastRefresh && <UtilitySeparator />}
          <AccountMenu placement="utility" />
        </>
      )}
      {onRefresh && (
        <>
          {(lastRefresh || showAccount) && <UtilitySeparator />}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="whitespace-nowrap text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </>
      )}

      <span className="relative inline-flex items-center gap-x-2 lg:hidden">
        {(lastRefresh || showAccount || onRefresh) && <UtilitySeparator />}
        {moreMenu}
      </span>

      <span className="hidden lg:inline-flex items-center gap-x-2">
        {hasContentBeforeShare && <UtilitySeparator />}
        {shareControl}
        <UtilitySeparator />
        {supportControl}
      </span>
    </div>
  );
}
