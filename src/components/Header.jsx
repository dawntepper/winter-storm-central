import { useState } from 'react';

export default function Header({ lastRefresh, lastSuccessfulUpdate, onRefresh, loading, stormPhase, isStale }) {
  const [shareMessage, setShareMessage] = useState('');

  const phaseLabels = {
    'pre-storm': 'Forecast Mode',
    'active': 'Storm Active',
    'post-storm': 'Storm Complete'
  };

  const phaseColors = {
    'pre-storm': 'bg-amber-600',
    'active': 'bg-emerald-600',
    'post-storm': 'bg-slate-500'
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Winter Storm Tracker - Storm Fern',
      text: 'Track Winter Storm Fern hitting the Eastern US Jan 24-26, 2026 #WinterStormFern',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
      }
    } catch (err) {
      // User cancelled or error
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
      }
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="text-2xl sm:text-3xl text-slate-300 flex-shrink-0">&#10052;</div>
          <div className="min-w-0">
            <h1
              className="text-lg sm:text-2xl font-semibold text-white tracking-tight truncate cursor-help"
              title="Disclaimer: Winter Storm Tracker uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at weather.gov and follow local emergency management guidance. Not affiliated with NOAA or NWS."
            >
              Winter Storm Tracker
            </h1>
            <div className="flex flex-col xs:flex-row xs:items-center gap-1 xs:gap-2 sm:gap-3 mt-0.5 sm:mt-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-slate-500">Now Tracking:</span>
                <a href="https://x.com/search?q=WinterStormFern" target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 text-xs sm:text-sm font-semibold transition-colors">Winter Storm Fern</a>
              </div>
              <span className="text-slate-700 hidden xs:inline">|</span>
              <div className="flex items-center gap-2">
                <a href="https://x.com/search?q=WinterStormFern" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 text-[10px] sm:text-xs font-medium transition-colors">#WinterStormFern</a>
                <span className="text-slate-600 hidden sm:inline">|</span>
                <span className="text-slate-400 text-[10px] sm:text-xs hidden sm:inline">Jan 24-26, 2026</span>
                <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded ${phaseColors[stormPhase]} text-white flex-shrink-0`}>
                  {phaseLabels[stormPhase]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* Last Updated - hidden on mobile */}
          <div className="text-right text-sm text-slate-400 hidden md:block">
            {lastRefresh && (
              <div className="flex items-center justify-end gap-2">
                {isStale && <span className="text-amber-400 text-xs">(cached)</span>}
                <p>Updated {lastRefresh.toLocaleTimeString()}</p>
              </div>
            )}
            <p className="text-xs text-slate-500">Auto-refresh every 30 min</p>
          </div>

          {/* Share Button */}
          <div className="relative">
            <button
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium
                         transition-colors flex items-center gap-2 border border-slate-600"
              title="Share this tracker"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
            {shareMessage && (
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-emerald-400 whitespace-nowrap bg-slate-800 px-2 py-1 rounded">
                {shareMessage}
              </span>
            )}
          </div>

          {/* Ko-fi Support Button */}
          <a
            href="https://ko-fi.com/dawntepper"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:px-3 sm:py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-400 text-sm font-medium transition-colors flex items-center gap-1.5 border border-slate-700 hover:border-amber-500/30"
            title="Support stormtracking.io"
          >
            <span className="text-base">☕</span>
            <span className="hidden lg:inline text-xs">Support</span>
          </a>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 sm:px-4 sm:py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                       disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium
                       transition-colors flex items-center gap-2 border border-slate-600"
          >
            <span className={loading ? 'animate-spin' : ''}>&#8635;</span>
            <span className="hidden sm:inline">{loading ? 'Loading...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
