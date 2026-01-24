import { useState } from 'react';
import { useWeatherData } from './hooks/useWeatherData';
import Header from './components/Header';
import ZipCodeSearch from './components/ZipCodeSearch';
import DualLeaderboard from './components/DualLeaderboard';
import CityCards from './components/CityCards';
import StormMap from './components/StormMap';

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
  const alerts = {
    'pre-storm': {
      title: 'Winter Storm Watch',
      message: 'A major winter storm is forecast for the Eastern US from January 24-26, 2026. Prepare now for hazardous travel conditions.',
      icon: '&#9888;',
      iconColor: 'text-amber-400',
      class: 'border-amber-500/30 bg-amber-500/5'
    },
    'active': {
      title: 'Winter Storm Warning',
      message: 'Winter storm is currently impacting the Eastern US. Avoid travel if possible. Monitor local conditions for updates.',
      icon: '&#9888;',
      iconColor: 'text-red-400',
      class: 'border-red-500/30 bg-red-500/5'
    },
    'post-storm': {
      title: 'Storm Recovery',
      message: 'The winter storm has passed. Use caution on roads as crews continue cleanup operations.',
      icon: '&#10003;',
      iconColor: 'text-slate-400',
      class: 'border-slate-500/30 bg-slate-500/5'
    }
  };

  const alert = alerts[stormPhase] || alerts['pre-storm'];

  return (
    <div className={`border rounded-xl p-3 sm:p-4 ${alert.class}`}>
      <div className="flex items-start gap-3">
        <span className={`text-lg sm:text-xl ${alert.iconColor} flex-shrink-0`} dangerouslySetInnerHTML={{ __html: alert.icon }} />
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-white mb-1">{alert.title}</h2>
          <p className="text-xs sm:text-sm text-slate-200">{alert.message}</p>
        </div>
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
          <span className="text-amber-300 font-semibold text-sm sm:text-base">Currently Showing Forecast Data</span>
        </div>
        <p className="text-amber-200/70 text-xs sm:text-sm">
          Actual accumulation totals will appear once the storm begins on Jan 24
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
        <span>Live data</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>Forecast</span>
      </div>
      <span className="text-slate-700 hidden sm:inline">|</span>
      <span className="w-full sm:w-auto">
        {stormPhase === 'pre-storm' && 'Storm begins Jan 24 - showing forecasts'}
        {stormPhase === 'active' && 'Storm active - tracking actual accumulations'}
        {stormPhase === 'post-storm' && 'Storm complete - showing final totals'}
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
    stormPhase,
    refresh,
    getSnowLeaderboard,
    getIceLeaderboard,
    getObservedSnowLeaderboard,
    getObservedIceLeaderboard,
    getCitiesGeoOrdered
  } = useWeatherData();

  const [userLocation, setUserLocation] = useState(null);

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
        onRefresh={refresh}
        loading={loading}
        stormPhase={stormPhase}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Storm Alert */}
        <StormAlert stormPhase={stormPhase} />

        {/* Zip Code Search */}
        <ZipCodeSearch stormPhase={stormPhase} onLocationChange={setUserLocation} />

        {/* Prominent Forecast Banner */}
        <ForecastBanner stormPhase={stormPhase} />

        {/* Data Source Legend */}
        <DataSourceLegend stormPhase={stormPhase} />

        {/* Leaderboards */}
        <section>
          <DualLeaderboard
            snowLeaderboard={getSnowLeaderboard()}
            iceLeaderboard={getIceLeaderboard()}
            observedSnowLeaderboard={getObservedSnowLeaderboard()}
            observedIceLeaderboard={getObservedIceLeaderboard()}
            stormPhase={stormPhase}
          />
        </section>

        {/* Storm Map */}
        <section>
          <StormMap weatherData={weatherData} stormPhase={stormPhase} userLocation={userLocation} />
        </section>

        {/* City Cards */}
        <section>
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">All Tracked Cities</h2>
          <CityCards cities={getCitiesGeoOrdered()} stormPhase={stormPhase} />
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-600 text-[10px] sm:text-xs py-4 border-t border-slate-800">
          <p>Data provided by NOAA National Weather Service</p>
        </footer>
      </main>
    </div>
  );
}
