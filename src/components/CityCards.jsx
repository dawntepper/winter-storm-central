const hazardColors = {
  snow: 'border-blue-500/30 bg-slate-800',
  ice: 'border-purple-500/30 bg-slate-800',
  mixed: 'border-slate-500/30 bg-slate-800',
  none: 'border-slate-700 bg-slate-800/50'
};

const hazardLabels = {
  snow: { text: 'Snow', class: 'text-blue-400' },
  ice: { text: 'Ice', class: 'text-purple-400' },
  mixed: { text: 'Mixed', class: 'text-slate-400' },
  none: { text: 'Clear', class: 'text-slate-500' }
};

const dangerBadges = {
  catastrophic: { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  dangerous: { label: 'Dangerous', class: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  caution: { label: 'Caution', class: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' },
  safe: null
};

function CityCard({ city }) {
  const colors = hazardColors[city.hazardType] || hazardColors.none;
  const hazard = hazardLabels[city.hazardType] || hazardLabels.none;
  const danger = dangerBadges[city.iceDanger];
  const obs = city.observation;

  return (
    <div className={`rounded-xl p-4 border ${colors} hover:border-slate-500 transition-colors`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-semibold text-white">{city.name}</h3>
          <span className={`text-xs font-medium ${hazard.class}`}>
            {hazard.text}
          </span>
        </div>
        {danger && (
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded ${danger.class}`}>
            {danger.label}
          </span>
        )}
      </div>

      {/* Current Observation */}
      {obs && (
        <div className="bg-slate-900/50 rounded-lg p-2 mb-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Live</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            {obs.temperature !== null && (
              <span className="text-2xl font-semibold text-white">{obs.temperature}°F</span>
            )}
            <span className="text-sm text-slate-400 truncate">{obs.conditions}</span>
          </div>
          {obs.windSpeed !== null && (
            <p className="text-xs text-slate-500 mt-1">Wind: {obs.windSpeed} mph</p>
          )}
        </div>
      )}

      {/* Accumulation Data */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-900/30 rounded-lg p-2 text-center">
          <p className="text-xl font-semibold text-blue-400">
            {city.forecast.snowfall > 0 ? `${city.forecast.snowfall.toFixed(2)}"` : '-'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Snow Fcst</p>
        </div>
        <div className="bg-slate-900/30 rounded-lg p-2 text-center">
          <p className="text-xl font-semibold text-purple-400">
            {city.forecast.ice > 0 ? `${city.forecast.ice.toFixed(2)}"` : '-'}
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ice Fcst</p>
        </div>
      </div>

      {/* Observed vs Forecast indicator */}
      {(city.observed.snowfall > 0 || city.observed.ice > 0) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-700/50 pt-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            Observed: {city.observed.snowfall.toFixed(2)}" snow, {city.observed.ice.toFixed(2)}" ice
          </span>
        </div>
      )}

      {/* Forecast conditions */}
      {!obs && city.conditions?.shortForecast && (
        <div className="text-sm text-slate-400 border-t border-slate-700/50 pt-2">
          <p className="truncate">{city.conditions.shortForecast}</p>
          {city.conditions.temperature && (
            <p className="text-slate-500 text-xs">
              {city.conditions.temperature}°{city.conditions.temperatureUnit}
            </p>
          )}
        </div>
      )}

      {city.error && (
        <p className="text-[10px] text-red-400/70 mt-2">Data may be incomplete</p>
      )}
    </div>
  );
}

export default function CityCards({ weatherData }) {
  const cities = Object.values(weatherData);

  if (cities.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">
        <p>No weather data available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cities.map(city => (
        <CityCard key={city.id} city={city} />
      ))}
    </div>
  );
}
