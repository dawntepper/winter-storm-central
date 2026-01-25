import { useState } from 'react';

export default function AccumulationsTable({ weatherData, userLocations = [], stormPhase }) {
  const [sortType, setSortType] = useState('snow'); // 'snow' or 'ice'
  const [sortBy, setSortBy] = useState('max'); // 'forecast' or 'max'

  // Combine all cities and user locations
  const allCities = [
    ...Object.values(weatherData).map(city => ({ ...city, isUserLocation: false })),
    ...userLocations.map(loc => ({ ...loc, isUserLocation: true }))
  ];

  // Filter to cities with forecast OR max accumulation data
  const citiesWithData = allCities.filter(city => {
    const forecastSnow = city.forecast?.snowfall || 0;
    const forecastIce = city.forecast?.ice || 0;
    const maxSnow = city.maxAccumulation?.snow || 0;
    const maxIce = city.maxAccumulation?.ice || 0;
    return forecastSnow > 0 || forecastIce > 0 || maxSnow > 0 || maxIce > 0;
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

  // Sort cities
  const sortedCities = [...uniqueCities].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'forecast') {
      aVal = sortType === 'snow' ? (a.forecast?.snowfall || 0) : (a.forecast?.ice || 0);
      bVal = sortType === 'snow' ? (b.forecast?.snowfall || 0) : (b.forecast?.ice || 0);
    } else {
      aVal = sortType === 'snow' ? (a.maxAccumulation?.snow || 0) : (a.maxAccumulation?.ice || 0);
      bVal = sortType === 'snow' ? (b.maxAccumulation?.snow || 0) : (b.maxAccumulation?.ice || 0);
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
        <p className="text-slate-400 text-sm">No forecast data available</p>
        <p className="text-slate-500 text-xs mt-1">Data will appear once NOAA issues forecasts</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-amber-400">&#9888;</span> Storm Fern Tracking
        </h2>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          Click headers to sort • Max values never decrease
        </p>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[1fr_auto] px-3 sm:px-4 py-2 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>City</span>
        <div className="grid grid-cols-4 gap-1 sm:gap-4">
          <button
            onClick={() => handleSort('snow', 'forecast')}
            className={`w-10 sm:w-16 text-right cursor-pointer hover:text-sky-300 transition-colors ${
              sortBy === 'forecast' && sortType === 'snow' ? 'text-sky-400 font-bold' : 'text-sky-400/70'
            }`}
          >
            <span className="hidden sm:inline">Snow F</span>
            <span className="sm:hidden">Sn F</span>
            {sortBy === 'forecast' && sortType === 'snow' && ' ▼'}
          </button>
          <button
            onClick={() => handleSort('snow', 'max')}
            className={`w-10 sm:w-16 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'max' && sortType === 'snow' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            <span className="hidden sm:inline">Snow Actual</span>
            <span className="sm:hidden">Sn A</span>
            {sortBy === 'max' && sortType === 'snow' && ' ▼'}
          </button>
          <button
            onClick={() => handleSort('ice', 'forecast')}
            className={`w-10 sm:w-16 text-right cursor-pointer hover:text-fuchsia-300 transition-colors ${
              sortBy === 'forecast' && sortType === 'ice' ? 'text-fuchsia-400 font-bold' : 'text-fuchsia-400/70'
            }`}
          >
            <span className="hidden sm:inline">Ice F</span>
            <span className="sm:hidden">Ic F</span>
            {sortBy === 'forecast' && sortType === 'ice' && ' ▼'}
          </button>
          <button
            onClick={() => handleSort('ice', 'max')}
            className={`w-10 sm:w-16 text-right cursor-pointer hover:text-emerald-300 transition-colors ${
              sortBy === 'max' && sortType === 'ice' ? 'text-emerald-400 font-bold' : 'text-emerald-400/70'
            }`}
          >
            <span className="hidden sm:inline">Ice Actual</span>
            <span className="sm:hidden">Ic A</span>
            {sortBy === 'max' && sortType === 'ice' && ' ▼'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-700/50 overflow-y-auto flex-1">
        {sortedCities.map((city) => {
          const forecastSnow = city.forecast?.snowfall || 0;
          const forecastIce = city.forecast?.ice || 0;
          const maxSnow = city.maxAccumulation?.snow || 0;
          const maxIce = city.maxAccumulation?.ice || 0;
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
              <div className="grid grid-cols-4 gap-1 sm:gap-4">
                <span className={`w-10 sm:w-16 text-right text-xs sm:text-sm font-semibold ${
                  sortBy === 'forecast' && sortType === 'snow' ? 'text-sky-300' : 'text-sky-300/70'
                }`}>
                  {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-10 sm:w-16 text-right text-xs sm:text-sm font-semibold ${
                  maxSnow > 0 ? (sortBy === 'max' && sortType === 'snow' ? 'text-emerald-400' : 'text-emerald-400/80') : 'text-slate-600'
                }`}>
                  {maxSnow > 0 ? `${maxSnow.toFixed(1)}"` : '-'}
                </span>
                <span className={`w-10 sm:w-16 text-right text-xs sm:text-sm font-semibold ${
                  sortBy === 'forecast' && sortType === 'ice' ? 'text-fuchsia-400' : 'text-fuchsia-400/70'
                }`}>
                  {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                </span>
                <span className={`w-10 sm:w-16 text-right text-xs sm:text-sm font-semibold ${
                  maxIce > 0 ? (sortBy === 'max' && sortType === 'ice' ? 'text-emerald-400' : 'text-emerald-400/80') : 'text-slate-600'
                }`}>
                  {maxIce > 0 ? `${maxIce.toFixed(2)}"` : '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 sm:px-4 py-2 bg-slate-900/30 border-t border-slate-700/50 text-[10px] text-slate-500">
        F = Forecast • Actual = Peak reported (never decreases) • {sortedCities.length} cities
      </div>
    </div>
  );
}
