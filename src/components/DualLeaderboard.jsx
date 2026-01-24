function SnowLeaderboard({ cities, stormPhase, userLocations = [], maxHeight, compact = false }) {
  // Combine forecast cities with user locations (always include if added to map)
  let displayCities = [...cities];

  // Add all user locations that aren't already in the list
  userLocations.forEach(userLoc => {
    const exists = displayCities.some(c => c.id === userLoc.id);
    if (!exists) {
      displayCities.push({ ...userLoc, isUserLocation: true });
    }
  });

  // Sort alphabetically by city name
  displayCities.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col ${compact ? 'flex-1' : ''}`}>
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-sky-300">&#10052;</span> Snow Totals
        </h2>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          Storm Fern | Jan 24-26
        </p>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>City</span>
        <div className="flex gap-4 sm:gap-6">
          <span className="w-16 text-right text-amber-400">Forecast</span>
          <span className="w-16 text-right text-emerald-400">Actual</span>
        </div>
      </div>

      <div
        className={`divide-y divide-slate-700/50 overflow-y-auto ${compact ? 'flex-1' : ''}`}
        style={{ maxHeight: !compact && maxHeight ? `${maxHeight}px` : 'none' }}
      >
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No significant snowfall forecast
          </div>
        ) : (
          displayCities.map((city) => {
            const forecast = city.forecast?.snowfall || 0;
            const actual = city.observed?.snowfall || 0;
            const isUser = city.isUserLocation;
            return (
              <div
                key={city.id}
                className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-slate-700/30 transition-colors ${
                  isUser ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {isUser && (
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold flex-shrink-0 bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500">
                      ★
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-200 font-medium text-xs sm:text-sm truncate">{city.name}</span>
                    {isUser && (
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded flex-shrink-0">You</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                  <span className="w-16 text-right text-sm sm:text-base font-semibold text-sky-300">
                    {forecast > 0 ? `${forecast.toFixed(1)}"` : '-'}
                  </span>
                  <span className={`w-16 text-right text-sm sm:text-base font-semibold ${
                    actual > 0 ? 'text-emerald-400' : 'text-slate-600'
                  }`}>
                    {actual > 0 ? `${actual.toFixed(1)}"` : '-'}
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

function IceLeaderboard({ cities, stormPhase, userLocations = [], compact = false }) {
  let displayCities = [...cities];

  // Add all user locations that aren't already in the list
  userLocations.forEach(userLoc => {
    const exists = displayCities.some(c => c.id === userLoc.id);
    if (!exists) {
      displayCities.push({ ...userLoc, isUserLocation: true });
    }
  });

  // Sort alphabetically by city name
  displayCities.sort((a, b) => a.name.localeCompare(b.name));

  const getDangerLevel = (ice) => {
    if (ice >= 0.5) return { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (ice >= 0.25) return { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    return null;
  };

  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden ${compact ? 'flex-1 flex flex-col' : ''}`}>
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <h2 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-fuchsia-400">&#9888;</span> Ice Danger Zone
        </h2>
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          &gt;0.25" dangerous | &gt;0.5" catastrophic
        </p>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 bg-slate-900/50 border-b border-slate-700/50 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>City</span>
        <div className="flex gap-4 sm:gap-6">
          <span className="w-16 text-right text-amber-400">Forecast</span>
          <span className="w-16 text-right text-emerald-400">Actual</span>
        </div>
      </div>

      <div className={`divide-y divide-slate-700/50 ${compact ? 'flex-1 overflow-y-auto' : ''}`}>
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No significant ice forecast
          </div>
        ) : (
          displayCities.map((city) => {
            const forecast = city.forecast?.ice || 0;
            const actual = city.observed?.ice || 0;
            const danger = getDangerLevel(forecast);
            const isUser = city.isUserLocation;
            return (
              <div
                key={city.id}
                className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-slate-700/30 transition-colors ${
                  isUser ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {isUser && (
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold flex-shrink-0 bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500">
                      ★
                    </span>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-200 font-medium text-xs sm:text-sm truncate">{city.name}</span>
                      {isUser && (
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded flex-shrink-0">You</span>
                      )}
                    </div>
                    {danger && (
                      <span className={`px-1 py-0.5 text-[8px] sm:text-[9px] font-medium rounded border w-fit ${danger.class}`}>
                        {danger.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                  <span className="w-16 text-right text-sm sm:text-base font-semibold text-fuchsia-400">
                    {forecast > 0 ? `${forecast.toFixed(2)}"` : '-'}
                  </span>
                  <span className={`w-16 text-right text-sm sm:text-base font-semibold ${
                    actual > 0 ? 'text-emerald-400' : 'text-slate-600'
                  }`}>
                    {actual > 0 ? `${actual.toFixed(2)}"` : '-'}
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
  userLocations = [],
  stackedLayout = false
}) {
  // Calculate max height for snow leaderboard based on ice leaderboard
  // Each row is roughly 40-48px
  const iceRowHeight = 44;
  const iceMaxItems = Math.min(10, (iceLeaderboard.length || 1) + userLocations.length);
  const maxHeight = stackedLayout ? undefined : iceMaxItems * iceRowHeight;

  // Stacked layout: vertical column for sidebar view
  if (stackedLayout) {
    return (
      <>
        <SnowLeaderboard
          cities={snowLeaderboard}
          stormPhase={stormPhase}
          userLocations={userLocations}
          compact
        />
        <IceLeaderboard
          cities={iceLeaderboard}
          stormPhase={stormPhase}
          userLocations={userLocations}
          compact
        />
      </>
    );
  }

  // Default: side-by-side grid layout
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <SnowLeaderboard
        cities={snowLeaderboard}
        stormPhase={stormPhase}
        userLocations={userLocations}
        maxHeight={maxHeight}
      />
      <IceLeaderboard
        cities={iceLeaderboard}
        stormPhase={stormPhase}
        userLocations={userLocations}
      />
    </div>
  );
}
