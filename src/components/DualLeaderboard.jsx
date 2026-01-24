function SnowLeaderboard({ cities, observed, stormPhase }) {
  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  const displayCities = isActive && observed.length > 0 ? observed : cities;
  const dataType = isActive && observed.length > 0 ? 'observed' : 'forecast';

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-blue-400">&#10052;</span> Snow Totals
          </h2>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            dataType === 'observed' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                                    : 'bg-slate-600/50 text-slate-400 border border-slate-600'
          }`}>
            {dataType === 'observed' ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {dataType === 'observed' ? 'Observed accumulation' : 'Expected for Jan 24-26'}
        </p>
      </div>

      <div className="divide-y divide-slate-700/50">
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            {dataType === 'observed' ? 'No snowfall recorded yet' : 'No significant snowfall forecast'}
          </div>
        ) : (
          displayCities.slice(0, 6).map((city, index) => {
            const amount = dataType === 'observed' ? city.observed.snowfall : city.forecast.snowfall;
            return (
              <div
                key={city.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold
                                ${index === 0 ? 'bg-amber-500/20 text-amber-400' :
                                  index === 1 ? 'bg-slate-400/20 text-slate-300' :
                                  index === 2 ? 'bg-amber-700/20 text-amber-600' :
                                  'bg-slate-700 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <span className="text-slate-200 font-medium">{city.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-semibold text-blue-400">
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
    if (ice >= 0.25) return { label: 'Dangerous', class: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return null;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-purple-400">&#9888;</span> Ice Accumulation
          </h2>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            dataType === 'observed' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                                    : 'bg-slate-600/50 text-slate-400 border border-slate-600'
          }`}>
            {dataType === 'observed' ? 'Actual' : 'Forecast'}
          </span>
        </div>
        <p className="text-slate-500 text-xs mt-1">
          &gt;0.25" dangerous | &gt;0.5" catastrophic
        </p>
      </div>

      <div className="divide-y divide-slate-700/50">
        {displayCities.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            {dataType === 'observed' ? 'No ice recorded yet' : 'No significant ice forecast'}
          </div>
        ) : (
          displayCities.slice(0, 6).map((city, index) => {
            const amount = dataType === 'observed' ? city.observed.ice : city.forecast.ice;
            const danger = getDangerLevel(amount);
            return (
              <div
                key={city.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold
                                ${index === 0 ? 'bg-red-500/20 text-red-400' :
                                  index === 1 ? 'bg-orange-500/20 text-orange-400' :
                                  index === 2 ? 'bg-yellow-500/20 text-yellow-500' :
                                  'bg-slate-700 text-slate-400'}`}>
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">{city.name}</span>
                    {danger && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${danger.class}`}>
                        {danger.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-semibold text-purple-400">
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
