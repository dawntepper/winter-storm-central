import { useState } from 'react';

// Format timestamp for display
function formatTimestamp(date) {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
    weekday: 'long'
  }).replace(',', '') + ' EST';
}

export default function AccumulationsTable({ weatherData, userLocations = [], stormPhase, lastRefresh, onCityClick }) {
  const [sortBy, setSortBy] = useState('snow'); // 'snow', 'ice', or 'name'

  // Combine all cities and user locations
  const allCities = [
    ...Object.values(weatherData).map(city => ({ ...city, isUserLocation: false })),
    ...userLocations.map(loc => ({ ...loc, isUserLocation: true }))
  ];

  // Filter to cities with forecast data
  const citiesWithData = allCities.filter(city => {
    const forecastSnow = city.forecast?.snowfall || 0;
    const forecastIce = city.forecast?.ice || 0;
    return forecastSnow > 0 || forecastIce > 0;
  });

  // Remove duplicates (prefer weatherData version over userLocation)
  const uniqueCities = citiesWithData.reduce((acc, city) => {
    const existingIndex = acc.findIndex(c => c.name === city.name);
    if (existingIndex === -1) {
      acc.push(city);
    } else if (!city.isUserLocation) {
      acc[existingIndex] = city;
    }
    return acc;
  }, []);

  // Sort cities - user locations always first, then by selected column
  const sortedCities = [...uniqueCities].sort((a, b) => {
    // User locations always come first
    if (a.isUserLocation && !b.isUserLocation) return -1;
    if (!a.isUserLocation && b.isUserLocation) return 1;

    // Then sort by selected column
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name); // Alphabetical A-Z
    }

    if (sortBy === 'snow') {
      return (b.forecast?.snowfall || 0) - (a.forecast?.snowfall || 0);
    }

    if (sortBy === 'ice') {
      return (b.forecast?.ice || 0) - (a.forecast?.ice || 0);
    }

    return 0;
  });

  if (sortedCities.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center">
        <p className="text-slate-400 text-sm">No forecast data available</p>
        <p className="text-slate-500 text-xs mt-1">Data will appear once NOAA issues forecasts</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2" title="Click city to view on map">
          <span className="text-amber-400">&#9888;</span> Storm Fern Tracking
          <span className="text-slate-500 text-sm cursor-help" title="Click city to view on map">ⓘ</span>
        </h2>
        <p className="text-slate-400 text-[10px] sm:text-xs mt-1">
          Forecast data from NOAA • Storm precipitation ended Jan 26 • Tracking ongoing impact
          {lastRefresh && ` • ${formatTimestamp(lastRefresh)}`}
        </p>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <button
          onClick={() => setSortBy('name')}
          className={`text-left cursor-pointer hover:text-slate-300 transition-colors ${
            sortBy === 'name' ? 'text-slate-300 font-bold' : ''
          }`}
        >
          City{sortBy === 'name' && ' ▼'}
        </button>
        <div className="grid grid-cols-2 gap-2 sm:gap-6">
          <button
            onClick={() => setSortBy('snow')}
            className={`w-16 sm:w-24 text-right cursor-pointer hover:text-sky-300 transition-colors ${
              sortBy === 'snow' ? 'text-sky-400 font-bold' : 'text-sky-400/70'
            }`}
          >
            <span className="hidden sm:inline">Snow</span>
            <span className="sm:hidden">Snow</span>
            {sortBy === 'snow' && ' ▼'}
          </button>
          <button
            onClick={() => setSortBy('ice')}
            className={`w-16 sm:w-24 text-right cursor-pointer hover:text-fuchsia-300 transition-colors ${
              sortBy === 'ice' ? 'text-fuchsia-400 font-bold' : 'text-fuchsia-400/70'
            }`}
          >
            <span className="hidden sm:inline">Ice</span>
            <span className="sm:hidden">Ice</span>
            {sortBy === 'ice' && ' ▼'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-700/50 overflow-y-auto flex-1">
        {sortedCities.map((city) => {
          const forecastSnow = city.forecast?.snowfall || 0;
          const forecastIce = city.forecast?.ice || 0;
          const isUser = city.isUserLocation;

          return (
            <div
              key={city.id || city.name}
              onClick={() => onCityClick && onCityClick(city)}
              className={`grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                isUser ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isUser && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500">
                    ★
                  </span>
                )}
                <span className="text-slate-200 font-medium text-xs sm:text-sm truncate">{city.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-6">
                <span className={`w-16 sm:w-24 text-right text-xs sm:text-sm font-semibold ${
                  sortBy === 'snow' ? 'text-sky-300' : 'text-sky-300/70'
                }`}>
                  {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-16 sm:w-24 text-right text-xs sm:text-sm font-semibold ${
                  sortBy === 'ice' ? 'text-fuchsia-400' : 'text-fuchsia-400/70'
                }`}>
                  {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 sm:px-4 py-2 bg-slate-900/30 border-t border-slate-700/50 text-[10px] sm:text-xs text-slate-500">
        Click headers to sort • {sortedCities.length} cities • Forecast data from NOAA
      </div>
    </div>
  );
}
