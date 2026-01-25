import { useState } from 'react';

export default function AccumulationsTable({ weatherData, userLocations = [], stormPhase }) {
  const [sortType, setSortType] = useState('snow'); // 'snow' or 'ice'

  // Combine all cities and user locations
  const allCities = [
    ...Object.values(weatherData).map(city => ({ ...city, isUserLocation: false })),
    ...userLocations.map(loc => ({ ...loc, isUserLocation: true }))
  ];

  // Filter to cities with forecast data
  const citiesWithForecasts = allCities.filter(city => {
    const forecastSnow = city.forecast?.snowfall || 0;
    const forecastIce = city.forecast?.ice || 0;
    return forecastSnow > 0 || forecastIce > 0;
  });

  // Remove duplicates (prefer weatherData version over userLocation)
  const uniqueCities = citiesWithForecasts.reduce((acc, city) => {
    const existingIndex = acc.findIndex(c => c.name === city.name);
    if (existingIndex === -1) {
      acc.push(city);
    } else if (!city.isUserLocation) {
      acc[existingIndex] = city;
    }
    return acc;
  }, []);

  // Sort cities by forecast
  const sortedCities = [...uniqueCities].sort((a, b) => {
    const aVal = sortType === 'snow' ? (a.forecast?.snowfall || 0) : (a.forecast?.ice || 0);
    const bVal = sortType === 'snow' ? (b.forecast?.snowfall || 0) : (b.forecast?.ice || 0);
    return bVal - aVal; // Descending
  });

  const handleSort = (type) => {
    setSortType(type);
  };

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
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-amber-400">&#9888;</span> Storm Fern Forecast
        </h2>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          NOAA forecast data • Click headers to sort
        </p>
      </div>

      {/* Column Headers - Forecast only */}
      <div className="grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>City</span>
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <button
            onClick={() => handleSort('snow')}
            className={`w-14 sm:w-20 text-right cursor-pointer hover:text-sky-300 transition-colors ${
              sortType === 'snow' ? 'text-sky-400 font-bold' : 'text-sky-400/70'
            }`}
          >
            Snow {sortType === 'snow' && '▼'}
          </button>
          <button
            onClick={() => handleSort('ice')}
            className={`w-14 sm:w-20 text-right cursor-pointer hover:text-fuchsia-300 transition-colors ${
              sortType === 'ice' ? 'text-fuchsia-400 font-bold' : 'text-fuchsia-400/70'
            }`}
          >
            Ice {sortType === 'ice' && '▼'}
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
              className={`grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-slate-700/30 transition-colors ${
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
                {isUser && (
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded flex-shrink-0">You</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <span className={`w-14 sm:w-20 text-right text-xs sm:text-sm font-semibold ${
                  sortType === 'snow' ? 'text-sky-300' : 'text-sky-300/70'
                }`}>
                  {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-14 sm:w-20 text-right text-xs sm:text-sm font-semibold ${
                  sortType === 'ice' ? 'text-fuchsia-400' : 'text-fuchsia-400/70'
                }`}>
                  {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 sm:px-4 py-2 bg-slate-900/30 border-t border-slate-700/50 text-[10px] text-slate-500">
        Showing NOAA forecast data. Live measurements update hourly.
      </div>
    </div>
  );
}
