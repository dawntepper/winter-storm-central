import { useState } from 'react';

export default function AccumulationsTable({ weatherData, userLocations = [], stormPhase }) {
  const [sortBy, setSortBy] = useState('actual'); // 'forecast' or 'actual'
  const [sortType, setSortType] = useState('snow'); // 'snow' or 'ice'

  // Combine all cities and user locations
  const allCities = [
    ...Object.values(weatherData).map(city => ({ ...city, isUserLocation: false })),
    ...userLocations.map(loc => ({ ...loc, isUserLocation: true }))
  ];

  // Filter to only cities with actual accumulations
  const citiesWithAccumulations = allCities.filter(city => {
    const observedSnow = city.observed?.snowfall || 0;
    const observedIce = city.observed?.ice || 0;
    return observedSnow > 0 || observedIce > 0;
  });

  // Remove duplicates (prefer weatherData version over userLocation)
  const uniqueCities = citiesWithAccumulations.reduce((acc, city) => {
    const existingIndex = acc.findIndex(c => c.name === city.name);
    if (existingIndex === -1) {
      acc.push(city);
    } else if (!city.isUserLocation) {
      acc[existingIndex] = city;
    }
    return acc;
  }, []);

  // Sort cities
  const sortedCities = [...uniqueCities].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'forecast') {
      aVal = sortType === 'snow' ? (a.forecast?.snowfall || 0) : (a.forecast?.ice || 0);
      bVal = sortType === 'snow' ? (b.forecast?.snowfall || 0) : (b.forecast?.ice || 0);
    } else {
      aVal = sortType === 'snow' ? (a.observed?.snowfall || 0) : (a.observed?.ice || 0);
      bVal = sortType === 'snow' ? (b.observed?.snowfall || 0) : (b.observed?.ice || 0);
    }
    return bVal - aVal; // Descending
  });

  const handleSort = (type, column) => {
    setSortType(type);
    setSortBy(column);
  };

  if (sortedCities.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 text-center">
        <p className="text-slate-400 text-sm">No accumulations recorded yet</p>
        <p className="text-slate-500 text-xs mt-1">Data will appear once snow or ice begins accumulating</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-emerald-400">&#10003;</span> Actual Accumulations
        </h2>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          Cities with recorded snow or ice • Click headers to sort
        </p>
      </div>

      {/* Column Headers - Mobile: 2 cols (actual only), Desktop: 4 cols */}
      <div className="grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>City</span>
        {/* Mobile: Show only Actual columns */}
        <div className="grid grid-cols-2 gap-3 sm:hidden">
          <button
            onClick={() => handleSort('snow', 'actual')}
            className={`w-12 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'actual' && sortType === 'snow' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            Snow {sortBy === 'actual' && sortType === 'snow' && '▼'}
          </button>
          <button
            onClick={() => handleSort('ice', 'actual')}
            className={`w-12 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'actual' && sortType === 'ice' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            Ice {sortBy === 'actual' && sortType === 'ice' && '▼'}
          </button>
        </div>
        {/* Desktop: Show all 4 columns */}
        <div className="hidden sm:grid grid-cols-4 gap-4">
          <button
            onClick={() => handleSort('snow', 'forecast')}
            className={`w-16 text-right cursor-pointer hover:text-amber-300 transition-colors ${
              sortBy === 'forecast' && sortType === 'snow' ? 'text-amber-400 font-bold' : 'text-amber-400/70'
            }`}
          >
            Snow F {sortBy === 'forecast' && sortType === 'snow' && '▼'}
          </button>
          <button
            onClick={() => handleSort('snow', 'actual')}
            className={`w-16 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'actual' && sortType === 'snow' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            Snow A {sortBy === 'actual' && sortType === 'snow' && '▼'}
          </button>
          <button
            onClick={() => handleSort('ice', 'forecast')}
            className={`w-16 text-right cursor-pointer hover:text-amber-300 transition-colors ${
              sortBy === 'forecast' && sortType === 'ice' ? 'text-amber-400 font-bold' : 'text-amber-400/70'
            }`}
          >
            Ice F {sortBy === 'forecast' && sortType === 'ice' && '▼'}
          </button>
          <button
            onClick={() => handleSort('ice', 'actual')}
            className={`w-16 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'actual' && sortType === 'ice' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            Ice A {sortBy === 'actual' && sortType === 'ice' && '▼'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-700/50 overflow-y-auto flex-1">
        {sortedCities.map((city) => {
          const forecastSnow = city.forecast?.snowfall || 0;
          const forecastIce = city.forecast?.ice || 0;
          const actualSnow = city.observed?.snowfall || 0;
          const actualIce = city.observed?.ice || 0;
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
              {/* Mobile: Show only Actual columns */}
              <div className="grid grid-cols-2 gap-3 sm:hidden">
                <span className={`w-12 text-right text-xs font-semibold ${
                  actualSnow > 0 ? 'text-emerald-400' : 'text-slate-600'
                }`}>
                  {actualSnow > 0 ? `${actualSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-12 text-right text-xs font-semibold ${
                  actualIce > 0 ? 'text-emerald-400' : 'text-slate-600'
                }`}>
                  {actualIce > 0 ? `${actualIce.toFixed(2)}"` : '-'}
                </span>
              </div>
              {/* Desktop: Show all 4 columns */}
              <div className="hidden sm:grid grid-cols-4 gap-4">
                <span className={`w-16 text-right text-sm font-semibold ${
                  sortBy === 'forecast' && sortType === 'snow' ? 'text-sky-300' : 'text-sky-300/70'
                }`}>
                  {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-16 text-right text-sm font-semibold ${
                  actualSnow > 0 ? (sortBy === 'actual' && sortType === 'snow' ? 'text-emerald-400' : 'text-emerald-400/80') : 'text-slate-600'
                }`}>
                  {actualSnow > 0 ? `${actualSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-16 text-right text-sm font-semibold ${
                  sortBy === 'forecast' && sortType === 'ice' ? 'text-fuchsia-400' : 'text-fuchsia-400/70'
                }`}>
                  {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                </span>
                <span className={`w-16 text-right text-sm font-semibold ${
                  actualIce > 0 ? (sortBy === 'actual' && sortType === 'ice' ? 'text-emerald-400' : 'text-emerald-400/80') : 'text-slate-600'
                }`}>
                  {actualIce > 0 ? `${actualIce.toFixed(2)}"` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 sm:px-4 py-2 bg-slate-900/30 border-t border-slate-700/50 text-[10px] text-slate-500">
        <span className="hidden sm:inline">F = Forecast • A = Actual • </span>Showing {sortedCities.length} cities with accumulations
      </div>
    </div>
  );
}
