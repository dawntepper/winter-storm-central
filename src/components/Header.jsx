import { useState } from 'react';

export default function Header({ lastRefresh, lastSuccessfulUpdate, onRefresh, loading, stormPhase, isStale }) {
  const [shareMessage, setShareMessage] = useState('');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const phaseLabels = {
    'pre-storm': 'Forecast Mode',
    'active': 'Storm Active',
    'post-storm': 'Impact Ongoing'
  };

  const phaseColors = {
    'pre-storm': 'bg-amber-500',
    'active': 'bg-emerald-600',
    'post-storm': 'bg-amber-500'
  };

  const handleShare = async () => {
    const shareData = {
      title: 'StormTracking - Extreme Weather Information',
      text: 'Get extreme weather information for your locations in real-time with live NOAA data',
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
          <div className="min-w-0 relative">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate flex items-center gap-2">
                <span className="text-xl sm:text-2xl">&#9888;&#65039;</span>
                StormTracking
              </h1>
              {/* Info icon with disclaimer tooltip on hover */}
              <div
                className="relative"
                onMouseEnter={() => setShowDisclaimer(true)}
                onMouseLeave={() => setShowDisclaimer(false)}
              >
                <span className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>

                {/* Disclaimer popup */}
                {showDisclaimer && (
                  <div className="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-w-xs sm:max-w-sm">
                    <span className="text-xs font-semibold text-slate-300 block mb-2">Disclaimer</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      StormTracking uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
                      <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline cursor-pointer">weather.gov</a>
                      {' '}and follow local emergency management guidance. Not affiliated with NOAA or NWS.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Get extreme weather information for your locations</p>
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
            <p className="text-xs text-slate-500">
              Contact: <a href="https://x.com/dawntepper_" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">@dawntepper_</a>
            </p>
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
