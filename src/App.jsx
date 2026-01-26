import { useState } from 'react';
import { useWeatherData } from './hooks/useWeatherData';
import { useActualAccumulations } from './hooks/useActualAccumulations';
import Header from './components/Header';
import ZipCodeSearch from './components/ZipCodeSearch';
import DualLeaderboard from './components/DualLeaderboard';
import AccumulationsTable from './components/AccumulationsTable';
import CityCards from './components/CityCards';
import StormMap from './components/StormMap';
import { AccumulationLeaderboard, AccumulationCard } from './components/ActualAccumulations';

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4 text-slate-400">&#10052;</div>
        <h2 className="text-xl font-semibold text-white mb-2">Loading Storm Data</h2>
        <p className="text-slate-500 text-sm">Fetching from NOAA Weather Service</p>
        <div className="mt-4 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-slate-500 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 max-w-md w-full">
        <div className="text-3xl mb-4 text-slate-400">&#9888;</div>
        <h2 className="text-lg font-semibold text-white mb-2">Error Loading Data</h2>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function StormAlert({ stormPhase }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const alerts = {
    'pre-storm': {
      title: 'Winter Storm Fern Alert',
      message: 'Winter Storm Fern is forecast for the Eastern US from January 24-26, 2026. Prepare now for hazardous travel conditions.',
      icon: '&#9888;',
      iconColor: 'text-amber-400',
      class: 'border-amber-500/30 bg-amber-500/5'
    },
    'active': {
      title: 'Winter Storm Fern Warning',
      message: 'Winter Storm Fern is currently impacting the Eastern US. Avoid travel if possible. Monitor local conditions for updates.',
      icon: '&#9888;',
      iconColor: 'text-red-400',
      class: 'border-red-500/30 bg-red-500/5'
    },
    'post-storm': {
      title: 'Storm Fern Recovery',
      message: 'Winter Storm Fern has passed. Use caution on roads as crews continue cleanup operations.',
      icon: '&#10003;',
      iconColor: 'text-slate-400',
      class: 'border-slate-500/30 bg-slate-500/5'
    }
  };

  const alert = alerts[stormPhase] || alerts['pre-storm'];

  return (
    <div className={`border rounded-xl ${alert.class} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg sm:text-xl ${alert.iconColor} flex-shrink-0`} dangerouslySetInnerHTML={{ __html: alert.icon }} />
          <h2 className="text-sm sm:text-base font-semibold text-white">{alert.title}</h2>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
          <div className="pl-8 sm:pl-10">
            <p className="text-xs sm:text-sm text-slate-200">{alert.message}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-2">
              Data updates every 30 minutes from NOAA. Always check{' '}
              <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>
              {' '}and local emergency alerts for official guidance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StaleDataBanner({ isStale, lastSuccessfulUpdate, error }) {
  if (!isStale && !error) return null;

  const formatTime = (date) => {
    if (!date) return 'Unknown';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">&#9888;</span>
          <span className="text-slate-300 font-medium text-sm">
            {error || 'Using cached data - NOAA API temporarily unavailable'}
          </span>
        </div>
        {lastSuccessfulUpdate && (
          <p className="text-slate-400 text-xs">
            Last successful update: {formatTime(lastSuccessfulUpdate)}
          </p>
        )}
      </div>
    </div>
  );
}

function ForecastBanner({ stormPhase }) {
  if (stormPhase !== 'pre-storm') return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></div>
          <span className="text-amber-300 font-semibold text-sm sm:text-base">NOAA Forecast Data</span>
        </div>
        <p className="text-amber-200/70 text-xs sm:text-sm">
          Forecasts update hourly from NOAA Weather Service
        </p>
      </div>
    </div>
  );
}

function DataSourceLegend({ stormPhase }) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-slate-500">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Live conditions</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>NOAA Forecast</span>
      </div>
      <span className="text-slate-700 hidden sm:inline">|</span>
      <span className="w-full sm:w-auto">
        {stormPhase === 'pre-storm' && 'Storm Fern begins Jan 24 - showing NOAA forecasts'}
        {stormPhase === 'active' && 'Storm Fern active - showing NOAA forecasts'}
        {stormPhase === 'post-storm' && 'Storm Fern complete - showing NOAA forecasts'}
      </span>
    </div>
  );
}

export default function App() {
  const {
    weatherData,
    loading,
    error,
    lastRefresh,
    lastSuccessfulUpdate,
    stormPhase,
    isStale,
    refresh,
    getSnowLeaderboard,
    getIceLeaderboard,
    getCitiesGeoOrdered
  } = useWeatherData();

  const [userLocations, setUserLocations] = useState([]);
  const [showOnlyUserLocations, setShowOnlyUserLocations] = useState(false);
  const [mapCenterOn, setMapCenterOn] = useState(null);

  // Premium feature: Actual accumulations from weather stations
  // Toggle this to test the premium feature locally
  const [showPremiumFeatures, setShowPremiumFeatures] = useState(true);

  const {
    accumulations,
    loading: accumulationsLoading,
    error: accumulationsError,
    lastUpdate: accumulationsLastUpdate,
    getAccumulationLeaderboard,
    getDisplayData
  } = useActualAccumulations(weatherData, userLocations, showPremiumFeatures);

  // Handle city click from table - center map on that city
  const handleCityClick = (city) => {
    if (city.lat && city.lon) {
      setMapCenterOn({ lat: city.lat, lon: city.lon, id: Date.now() });
    }
  };

  const hasData = Object.keys(weatherData).length > 0;

  if (loading && !hasData) {
    return <LoadingState />;
  }

  if (error && !hasData) {
    return <ErrorState error={error} onRetry={refresh} />;
  }

  return (
    <div className="min-h-screen">
      <Header
        lastRefresh={lastRefresh}
        lastSuccessfulUpdate={lastSuccessfulUpdate}
        onRefresh={refresh}
        loading={loading}
        stormPhase={stormPhase}
        isStale={isStale}
      />

      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* SEO Header Section */}
        <header className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">
            Winter Storm Fern Tracker - Live Updates
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-3xl">
            Track Winter Storm Fern affecting 180M+ Americans across the Eastern US (Jan 24-26, 2026).
            Real-time NOAA data showing snow accumulation, ice danger, and live radar.
            Monitor your family's locations with custom tracking.
          </p>
        </header>

        {/* Stale Data Warning */}
        <StaleDataBanner isStale={isStale} lastSuccessfulUpdate={lastSuccessfulUpdate} error={error && hasData ? error : null} />

        {/* Storm Alert */}
        <StormAlert stormPhase={stormPhase} />

        {/* Location Search - moved to top */}
        <ZipCodeSearch stormPhase={stormPhase} onLocationsChange={setUserLocations} />

        {/* View Toggle + Premium Toggle */}
        <div className="flex flex-wrap items-center gap-4">
          {userLocations.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">View:</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => setShowOnlyUserLocations(false)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    !showOnlyUserLocations
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  All Locations
                </button>
                <button
                  onClick={() => setShowOnlyUserLocations(true)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    showOnlyUserLocations
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  My Locations ({userLocations.length})
                </button>
              </div>
            </div>
          )}

          {/* Premium Feature Toggle (for testing) */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPremiumFeatures}
                onChange={(e) => setShowPremiumFeatures(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
              />
              <span className="text-xs text-slate-400">
                Show Actual Accumulations
                <span className="ml-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">PREMIUM</span>
              </span>
            </label>
          </div>
        </div>

        {/* Main Grid: Map + Leaderboards side-by-side on desktop */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-4 lg:gap-6">
          {/* Left: Storm Map */}
          <div className="lg:min-h-[600px]">
            <StormMap
              weatherData={showOnlyUserLocations ? {} : weatherData}
              stormPhase={stormPhase}
              userLocations={userLocations}
              isHero
              isSidebar
              centerOn={mapCenterOn}
            />
          </div>

          {/* Right: Leaderboards/Accumulations stacked vertically */}
          <div className="flex flex-col gap-4 lg:gap-5">
            {/* Show Accumulations Table during active/post-storm, Leaderboards during pre-storm */}
            {stormPhase === 'pre-storm' ? (
              <>
                <DualLeaderboard
                  snowLeaderboard={showOnlyUserLocations ? [] : getSnowLeaderboard()}
                  iceLeaderboard={showOnlyUserLocations ? [] : getIceLeaderboard()}
                  stormPhase={stormPhase}
                  userLocations={userLocations}
                  stackedLayout
                />
                {/* Premium: Actual Accumulations Leaderboard */}
                {showPremiumFeatures && (
                  <AccumulationLeaderboard
                    data={getAccumulationLeaderboard(10)}
                    title="Actual Storm Totals"
                  />
                )}
              </>
            ) : (
              <>
                <AccumulationsTable
                  weatherData={showOnlyUserLocations ? {} : weatherData}
                  userLocations={userLocations}
                  stormPhase={stormPhase}
                  lastRefresh={lastRefresh}
                  onCityClick={handleCityClick}
                />
                {/* Premium: Actual Accumulations Leaderboard */}
                {showPremiumFeatures && (
                  <AccumulationLeaderboard
                    data={getAccumulationLeaderboard(10)}
                    title="Actual Storm Totals"
                  />
                )}
                <DualLeaderboard
                  snowLeaderboard={showOnlyUserLocations ? [] : getSnowLeaderboard()}
                  iceLeaderboard={showOnlyUserLocations ? [] : getIceLeaderboard()}
                  stormPhase={stormPhase}
                  userLocations={userLocations}
                  stackedLayout
                />
              </>
            )}
          </div>
        </section>

        {/* Prominent Forecast Banner */}
        <ForecastBanner stormPhase={stormPhase} />

        {/* Data Source Legend */}
        <DataSourceLegend stormPhase={stormPhase} />

        {/* City Cards - Full Width */}
        <section>
          <CityCards
            cities={showOnlyUserLocations ? [] : getCitiesGeoOrdered()}
            stormPhase={stormPhase}
            userLocations={userLocations}
            showOnlyUserLocations={showOnlyUserLocations}
          />
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-800 space-y-4">
          {/* Ko-fi Support */}
          <a
            href="https://ko-fi.com/dawntepper"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-400 text-sm transition-colors border border-slate-700 hover:border-amber-500/30"
          >
            <span className="text-lg">☕</span>
            <span>Thank you for supporting stormtracking.io</span>
          </a>

          <p className="text-slate-500 text-xs max-w-2xl mx-auto px-4">
            <span className="font-medium text-slate-400">Disclaimer:</span> Winter Storm Tracker uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
            <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>
            {' '}and follow local emergency management guidance. Not affiliated with NOAA or NWS.
          </p>
        </footer>
      </main>
    </div>
  );
}
