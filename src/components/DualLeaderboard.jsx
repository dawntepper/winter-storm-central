function SnowLeaderboard({ cities, observed, stormPhase }) {
  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  const displayCities = isActive && observed.length > 0 ? observed : cities;
  const dataType = isActive && observed.length > 0 ? 'observed' : 'forecast';

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
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
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          {dataType === 'observed' ? 'Observed accumulation (west to east)' : 'Expected for Jan 24-26 (west to east)'}
        </p>
      </div>

      <div className="divide-y divide-slate-700/50">
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {dataType === 'observed' ? 'No snowfall recorded yet' : 'No significant snowfall forecast'}
          </div>
        ) : (
          displayCities.slice(0, 10).map((city, index) => {
            const amount = dataType === 'observed' ? city.observed.snowfall : city.forecast.snowfall;
            return (
              <div
                key={city.id}
                className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold flex-shrink-0
                                ${index === 0 ? 'bg-amber-500/20 text-amber-400' :
                                  index === 1 ? 'bg-slate-400/20 text-slate-300' :
                                  index === 2 ? 'bg-amber-700/20 text-amber-600' :
                                  'bg-slate-700 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <span className="text-slate-200 font-medium text-sm sm:text-base truncate">{city.name}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-lg sm:text-xl font-semibold text-sky-300">
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

function IceLeaderboard({ cities, observed, stormPhase }) {
  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  const displayCities = isActive && observed.length > 0 ? observed : cities;
  const dataType = isActive && observed.length > 0 ? 'observed' : 'forecast';

  const getDangerLevel = (ice) => {
    if (ice >= 0.5) return { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (ice >= 0.25) return { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border-red-500/30' };  // Red for urgency
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
        <p className="text-slate-500 text-[10px] sm:text-xs mt-1">
          &gt;0.25" dangerous | &gt;0.5" catastrophic
        </p>
      </div>

      <div className="divide-y divide-slate-700/50">
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            {dataType === 'observed' ? 'No ice recorded yet' : 'No significant ice forecast'}
          </div>
        ) : (
          displayCities.slice(0, 6).map((city, index) => {
            const amount = dataType === 'observed' ? city.observed.ice : city.forecast.ice;
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
  stormPhase = 'pre-storm'
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <SnowLeaderboard
        cities={snowLeaderboard}
        observed={observedSnowLeaderboard}
        stormPhase={stormPhase}
      />
      <IceLeaderboard
        cities={iceLeaderboard}
        observed={observedIceLeaderboard}
        stormPhase={stormPhase}
      />
    </div>
  );
}
