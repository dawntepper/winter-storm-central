import { useState } from 'react';

function SortToggle({ sortBy, onSortChange }) {
  return (
    <div className="flex items-center gap-1 text-[10px]">
      <span className="text-slate-500">Sort:</span>
      <button
        onClick={() => onSortChange('amount')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          sortBy === 'amount'
            ? 'bg-slate-600 text-white'
            : 'text-slate-400 hover:text-slate-300'
        }`}
      >
        Totals
      </button>
      <button
        onClick={() => onSortChange('city')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          sortBy === 'city'
            ? 'bg-slate-600 text-white'
            : 'text-slate-400 hover:text-slate-300'
        }`}
      >
        City
      </button>
    </div>
  );
}

function SnowLeaderboard({ cities, observed, stormPhase, userLocation, maxHeight }) {
  const [sortBy, setSortBy] = useState('amount');
  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';

  // Start with the appropriate data source
  let displayCities = isActive && observed.length > 0 ? [...observed] : [...cities];
  const dataType = isActive && observed.length > 0 ? 'observed' : 'forecast';

  // Add user location if it has snow data
  if (userLocation) {
    const userSnow = dataType === 'observed' ? userLocation.observed?.snowfall : userLocation.forecast?.snowfall;
    if (userSnow > 0) {
      // Check if user location is not already in the list
      const exists = displayCities.some(c => c.id === userLocation.id);
      if (!exists) {
        displayCities.push({ ...userLocation, isUserLocation: true });
      }
    }
  }

  // Sort the cities
  if (sortBy === 'amount') {
    displayCities.sort((a, b) => {
      const amountA = dataType === 'observed' ? a.observed?.snowfall || 0 : a.forecast?.snowfall || 0;
      const amountB = dataType === 'observed' ? b.observed?.snowfall || 0 : b.forecast?.snowfall || 0;
      return amountB - amountA;
    });
  } else {
    displayCities.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-sky-300">&#10052;</span> Snow Totals
          </h2>
          <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded border ${
            dataType === 'observed'
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            {dataType === 'observed' ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-slate-500 text-[10px] sm:text-xs">
            {dataType === 'observed' ? 'Observed accumulation' : 'Expected for Jan 24-26'}
          </p>
          <SortToggle sortBy={sortBy} onSortChange={setSortBy} />
        </div>
      </div>

      <div
        className="divide-y divide-slate-700/50 overflow-y-auto"
        style={{ maxHeight: maxHeight ? `${maxHeight}px` : 'none' }}
      >
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {dataType === 'observed' ? 'No snowfall recorded yet' : 'No significant snowfall forecast'}
          </div>
        ) : (
          displayCities.map((city, index) => {
            const amount = dataType === 'observed' ? city.observed?.snowfall || 0 : city.forecast?.snowfall || 0;
            const isUser = city.isUserLocation;
            return (
              <div
                key={city.id}
                className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-700/30 transition-colors ${
                  isUser ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold flex-shrink-0
                                ${isUser ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500' :
                                  index === 0 ? 'bg-amber-500/20 text-amber-400' :
                                  index === 1 ? 'bg-slate-400/20 text-slate-300' :
                                  index === 2 ? 'bg-amber-700/20 text-amber-600' :
                                  'bg-slate-700 text-slate-400'}`}>
                    {isUser ? '★' : index + 1}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-200 font-medium text-sm sm:text-base truncate">{city.name}</span>
                    {isUser && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">You</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-lg sm:text-xl font-semibold ${isUser ? 'text-emerald-400' : 'text-sky-300'}`}>
                    {amount.toFixed(2)}"
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function IceLeaderboard({ cities, observed, stormPhase, onHeightMeasured }) {
  const [sortBy, setSortBy] = useState('amount');
  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  let displayCities = isActive && observed.length > 0 ? [...observed] : [...cities];
  const dataType = isActive && observed.length > 0 ? 'observed' : 'forecast';

  // Sort the cities
  if (sortBy === 'amount') {
    displayCities.sort((a, b) => {
      const amountA = dataType === 'observed' ? a.observed?.ice || 0 : a.forecast?.ice || 0;
      const amountB = dataType === 'observed' ? b.observed?.ice || 0 : b.forecast?.ice || 0;
      return amountB - amountA;
    });
  } else {
    displayCities.sort((a, b) => a.name.localeCompare(b.name));
  }

  const getDangerLevel = (ice) => {
    if (ice >= 0.5) return { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (ice >= 0.25) return { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    return null;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-fuchsia-400">&#9888;</span> Ice Danger Zone
          </h2>
          <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded border ${
            dataType === 'observed'
              ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>
            {dataType === 'observed' ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-slate-500 text-[10px] sm:text-xs">
            &gt;0.25" dangerous | &gt;0.5" catastrophic
          </p>
          <SortToggle sortBy={sortBy} onSortChange={setSortBy} />
        </div>
      </div>

      <div className="divide-y divide-slate-700/50">
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {dataType === 'observed' ? 'No ice recorded yet' : 'No significant ice forecast'}
          </div>
        ) : (
          displayCities.slice(0, 6).map((city, index) => {
            const amount = dataType === 'observed' ? city.observed?.ice || 0 : city.forecast?.ice || 0;
            const danger = getDangerLevel(amount);
            return (
              <div
                key={city.id}
                className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold flex-shrink-0
                                ${index === 0 ? 'bg-red-500/20 text-red-400' :
                                  index === 1 ? 'bg-red-500/15 text-red-400' :
                                  index === 2 ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-slate-700 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                    <span className="text-slate-200 font-medium text-sm sm:text-base truncate">{city.name}</span>
                    {danger && (
                      <span className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium rounded border w-fit ${danger.class}`}>
                        {danger.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-lg sm:text-xl font-semibold text-fuchsia-400">
                    {amount.toFixed(2)}"
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function DualLeaderboard({
  snowLeaderboard,
  iceLeaderboard,
  observedSnowLeaderboard = [],
  observedIceLeaderboard = [],
  stormPhase = 'pre-storm',
  userLocation = null
}) {
  // Calculate max height for snow leaderboard based on ice leaderboard
  // Ice shows max 6 items, each row is roughly 44-52px
  const iceRowHeight = 48;
  const iceMaxItems = Math.min(6, iceLeaderboard.length || 1);
  const maxHeight = iceMaxItems * iceRowHeight;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <SnowLeaderboard
        cities={snowLeaderboard}
        observed={observedSnowLeaderboard}
        stormPhase={stormPhase}
        userLocation={userLocation}
        maxHeight={maxHeight}
      />
      <IceLeaderboard
        cities={iceLeaderboard}
        observed={observedIceLeaderboard}
        stormPhase={stormPhase}
      />
    </div>
  );
}
