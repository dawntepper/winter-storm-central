import { useState } from 'react';
import { trackShare, trackManualRefresh } from '../utils/analytics';

/**
 * Compact homepage utility row: updated timestamp, refresh, share.
 * Placed below the hero title / above the map — not in the main site header.
 */
export default function HomeUtilityBar({ lastRefresh, onRefresh, loading, isStale }) {
  const [shareMessage, setShareMessage] = useState('');

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
    }
  };

  const handleRefresh = () => {
    trackManualRefresh();
    onRefresh?.();
  };

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      {lastRefresh && (
        <span>
          Updated {formatTime(lastRefresh)}
          {isStale && <span className="text-amber-400/90 ml-1">(cached)</span>}
        </span>
      )}
      {lastRefresh && onRefresh && <span aria-hidden="true" className="text-slate-600">•</span>}
      {onRefresh && (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
      {(lastRefresh || onRefresh) && <span aria-hidden="true" className="text-slate-600">•</span>}
      <span className="relative">
        <button
          type="button"
          onClick={handleShare}
          className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          Share
        </button>
        {shareMessage && (
          <span className="absolute left-0 top-full mt-0.5 text-[10px] text-emerald-400 whitespace-nowrap">
            {shareMessage}
          </span>
        )}
      </span>
    </div>
  );
}
