import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { trackManualRefresh, NAV_SOURCES } from '../utils/analytics';
import AccountMenu from './auth/AccountMenu';
import HomeUtilityBar from './HomeUtilityBar';
import PageHeaderNav from './PageHeaderNav';

const SITE_SETTINGS_KEY = 'stormtracking_site_settings';

function getSiteSettings() {
  try {
    const saved = localStorage.getItem(SITE_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { showBetaBadge: true };
  } catch {
    return { showBetaBadge: true };
  }
}

export default function Header({ lastRefresh, onRefresh, loading, isStale, showUtilities = false }) {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showBetaTooltip, setShowBetaTooltip] = useState(false);
  const [showBetaBadge, setShowBetaBadge] = useState(() => getSiteSettings().showBetaBadge);

  useEffect(() => {
    const handleSettingsChange = (e) => {
      setShowBetaBadge(e.detail?.showBetaBadge ?? true);
    };
    window.addEventListener('siteSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('siteSettingsChanged', handleSettingsChange);
  }, []);

  const handleRefresh = () => {
    trackManualRefresh();
    onRefresh?.();
  };

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return (
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-2.5" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">📡</span>
            StormTracking
          </p>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-slate-500">
                {lastRefresh.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-white transition-colors border border-slate-700 cursor-pointer"
            >
              <span className={`text-sm ${loading ? 'animate-spin' : ''}`}>&#8635;</span>
            </button>
          </div>
        </div>
      </header>
    );
  }

  const brandBlock = (
    <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
      <p className="text-base sm:text-2xl lg:text-xl font-bold text-white tracking-tight truncate flex items-center gap-1.5 sm:gap-2">
        <span className="text-lg sm:text-2xl lg:text-xl" aria-hidden="true">📡</span>
        StormTracking
      </p>
      {showBetaBadge && (
        <div
          className="relative flex-shrink-0"
          onMouseEnter={() => setShowBetaTooltip(true)}
          onMouseLeave={() => setShowBetaTooltip(false)}
        >
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-900 rounded cursor-help">
            BETA
          </span>
          {showBetaTooltip && (
            <div className="absolute top-full left-0 mt-1 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-64">
              <p className="text-xs text-slate-300 leading-relaxed">
                StormTracking is in active development. For official weather information, please visit{' '}
                <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>
              </p>
            </div>
          )}
        </div>
      )}
      <div
        className="relative flex-shrink-0"
        onMouseEnter={() => setShowDisclaimer(true)}
        onMouseLeave={() => setShowDisclaimer(false)}
      >
        <span className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        {showDisclaimer && (
          <div className="absolute top-full left-0 mt-1 p-4 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 w-72 sm:w-96">
            <span className="text-sm font-semibold text-slate-200 block mb-2">Disclaimer</span>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              StormTracking uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
              <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline cursor-pointer">weather.gov</a>
              {' '}and follow local emergency management guidance. Not affiliated with NOAA or NWS.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const accountTop = (
    <AccountMenu placement="headerTop" showSignedInFallback={!showUtilities} />
  );

  const utilityBar = showUtilities ? (
    <HomeUtilityBar
      lastRefresh={lastRefresh}
      onRefresh={onRefresh}
      loading={loading}
      isStale={isStale}
    />
  ) : null;

  return (
    <header
      className="bg-slate-900 border-b border-slate-700 px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-2.5"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}
    >
      <div className="max-w-[1400px] mx-auto flex flex-col gap-1 lg:gap-1">
        {/* Mobile / tablet: Brand → Nav+More → status */}
        <div className="flex lg:hidden flex-col gap-1">
          <div className="flex items-center justify-between gap-3 min-w-0">
            {brandBlock}
            <div className="flex-shrink-0">{accountTop}</div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <PageHeaderNav
              source={NAV_SOURCES.HEADER_NAVIGATION}
              stateSource={NAV_SOURCES.HOMEPAGE_STATE_DROPDOWN}
              compactCluster
              className="flex-1 min-w-0"
            />
            {showUtilities && (
              <HomeUtilityBar
                mode="more"
                lastRefresh={lastRefresh}
                onRefresh={onRefresh}
                loading={loading}
                isStale={isStale}
              />
            )}
          </div>
          {showUtilities && (
            <HomeUtilityBar
              mode="status"
              lastRefresh={lastRefresh}
              onRefresh={onRefresh}
              loading={loading}
              isStale={isStale}
            />
          )}
        </div>

        {/* Desktop lg+: brand + nav; utilities + sign-in on the right */}
        <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-6">
          <div className="flex items-center gap-5 xl:gap-6 min-w-0">
            {brandBlock}
            <PageHeaderNav
              source={NAV_SOURCES.HEADER_NAVIGATION}
              stateSource={NAV_SOURCES.HOMEPAGE_STATE_DROPDOWN}
            />
          </div>

          <div className="flex items-center gap-3 xl:gap-4 flex-shrink-0">
            {utilityBar && <div className="hidden xl:block">{utilityBar}</div>}
            {accountTop}
          </div>
        </div>

        {utilityBar && (
          <div className="hidden lg:flex xl:hidden justify-end">
            {utilityBar}
          </div>
        )}
      </div>
    </header>
  );
}
