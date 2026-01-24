import { useWeatherData } from './hooks/useWeatherData';
import Header from './components/Header';
import DualLeaderboard from './components/DualLeaderboard';
import CityCards from './components/CityCards';
import StormMap from './components/StormMap';

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md">
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
      class: 'border-amber-500/30 bg-amber-500/5'
    },
    'active': {
      title: 'Winter Storm Warning',
      message: 'Winter storm is currently impacting the Eastern US. Avoid travel if possible. Monitor local conditions for updates.',
      class: 'border-red-500/30 bg-red-500/5'
    },
    'post-storm': {
      title: 'Storm Recovery',
      message: 'The winter storm has passed. Use caution on roads as crews continue cleanup operations.',
      class: 'border-slate-500/30 bg-slate-500/5'
    }
  };

  const alert = alerts[stormPhase] || alerts['pre-storm'];

  return (
    <div className={`border rounded-xl p-4 ${alert.class}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl text-amber-400">&#9888;</span>
        <div>
          <h2 className="text-base font-semibold text-white mb-1">{alert.title}</h2>
          <p className="text-sm text-slate-200">{alert.message}</p>
        </div>
      </div>
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
    getObservedIceLeaderboard
  } = useWeatherData();

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

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Storm Alert */}
        <StormAlert stormPhase={stormPhase} />

        {/* Data Source Indicator */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Live observation data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span>Forecast data</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>
            {stormPhase === 'pre-storm' && 'Showing forecasts until storm begins'}
            {stormPhase === 'active' && 'Tracking actual accumulations'}
            {stormPhase === 'post-storm' && 'Showing final storm totals'}
          </span>
        </div>

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
          <StormMap weatherData={weatherData} />
        </section>

        {/* City Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">All Tracked Cities</h2>
          <CityCards weatherData={weatherData} />
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-600 text-xs py-4 border-t border-slate-800">
          <p>Data provided by NOAA National Weather Service</p>
        </footer>
      </main>
    </div>
  );
}
