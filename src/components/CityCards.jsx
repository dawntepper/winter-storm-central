// Atmospheric color palette
const hazardColors = {
  snow: 'border-sky-300/30 bg-slate-800',      // Softer winter sky blue
  ice: 'border-fuchsia-400/30 bg-slate-800',   // Ominous purple
  mixed: 'border-slate-400/30 bg-slate-800',   // Lighter slate
  none: 'border-slate-700 bg-slate-800/50'
};

const hazardLabels = {
  snow: { text: 'Snow', class: 'text-sky-300' },        // #93C5FD equivalent
  ice: { text: 'Ice', class: 'text-fuchsia-400' },      // #E879F9 equivalent
  mixed: { text: 'Mixed', class: 'text-slate-400' },    // #94A3B8
  none: { text: 'Clear', class: 'text-slate-500' }
};

const dangerBadges = {
  catastrophic: { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  dangerous: { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  caution: { label: 'Caution', class: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  safe: null
};

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function CityCard({ city, stormPhase, isUserLocation = false }) {
  const colors = isUserLocation
    ? 'border-emerald-500/50 bg-slate-800 ring-1 ring-emerald-500/30'
    : (hazardColors[city.hazardType] || hazardColors.none);
  const hazard = hazardLabels[city.hazardType] || hazardLabels.none;
  const danger = dangerBadges[city.iceDanger];
  const obs = city.observation;

  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';

  // Use station observation for actual snow if available
  const stationSnow = obs?.snowDepth;
  const actualSnow = stationSnow !== null && stationSnow !== undefined ? stationSnow : (city.observed?.snowfall || 0);
  const actualIce = city.observed?.ice || 0;
  const hasStationData = stationSnow !== null && stationSnow !== undefined;
  const hasObserved = actualSnow > 0 || actualIce > 0;

  return (
    <div className={`rounded-xl p-3 sm:p-4 border ${colors} hover:border-slate-500 transition-colors relative`}>
      {/* User Location Badge */}
      {isUserLocation && (
        <div className="absolute -top-2 left-3">
          <span className="bg-emerald-500 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
            Your Location
          </span>
        </div>
      )}
      {/* Header */}
      <div className={`flex justify-between items-start mb-2 sm:mb-3 ${isUserLocation ? 'mt-1' : ''}`}>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-semibold text-white truncate">{city.name}</h3>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] sm:text-xs font-medium ${hazard.class}`}>
              {hazard.text}
            </span>
            {city.lastUpdated && (
              <span className="text-[9px] sm:text-[10px] text-slate-600">
                {formatTime(city.lastUpdated)}
              </span>
            )}
          </div>
        </div>
        {danger && (
          <span className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded flex-shrink-0 ${danger.class}`}>
            {danger.label}
          </span>
        )}
      </div>

      {/* Current Observation */}
      {obs && (
        <div className="bg-slate-900/50 rounded-lg p-2 mb-2 sm:mb-3 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Live</span>
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            {obs.temperature !== null && (
              <span className="text-xl sm:text-2xl font-semibold text-white">{obs.temperature}°F</span>
            )}
            <span className="text-xs sm:text-sm text-slate-400 truncate">{obs.conditions}</span>
          </div>
          {obs.windSpeed !== null && (
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1">Wind: {obs.windSpeed} mph</p>
          )}
        </div>
      )}

      {/* Accumulation Data - Expected */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-slate-900/30 rounded-lg p-2 text-center">
          <p className="text-lg sm:text-xl font-semibold text-sky-300">
            {city.forecast?.snowfall > 0 ? `${city.forecast.snowfall.toFixed(2)}"` : '-'}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wide">
            Snow {stormPhase === 'pre-storm' ? 'Fcst' : 'Exp'}
          </p>
        </div>
        <div className="bg-slate-900/30 rounded-lg p-2 text-center">
          <p className="text-lg sm:text-xl font-semibold text-fuchsia-400">
            {city.forecast?.ice > 0 ? `${city.forecast.ice.toFixed(2)}"` : '-'}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wide">
            Ice {stormPhase === 'pre-storm' ? 'Fcst' : 'Exp'}
          </p>
        </div>
      </div>

      {/* Accumulation Data - Actual */}
      <div className="grid grid-cols-2 gap-2 mb-2 sm:mb-3">
        <div className={`rounded-lg p-2 text-center ${hasObserved ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-900/20 border border-slate-700/30'}`}>
          {actualSnow > 0 ? (
            <p className="text-lg sm:text-xl font-semibold text-emerald-400">
              {actualSnow.toFixed(1)}"
            </p>
          ) : isActive && city.forecast?.snowfall > 0 ? (
            <p className="text-sm sm:text-base font-medium text-amber-400/70 italic">
              Accum...
            </p>
          ) : (
            <p className="text-lg sm:text-xl font-semibold text-slate-600">-</p>
          )}
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wide">
            Snow Actual
            {hasStationData && obs?.isRecent && actualSnow > 0 && (
              <span className="ml-1 text-emerald-500">Live</span>
            )}
          </p>
        </div>
        <div className={`rounded-lg p-2 text-center ${actualIce > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-900/20 border border-slate-700/30'}`}>
          {actualIce > 0 ? (
            <p className="text-lg sm:text-xl font-semibold text-emerald-400">
              {actualIce.toFixed(2)}"
            </p>
          ) : isActive && city.forecast?.ice > 0 ? (
            <p className="text-sm sm:text-base font-medium text-amber-400/70 italic">
              Accum...
            </p>
          ) : (
            <p className="text-lg sm:text-xl font-semibold text-slate-600">-</p>
          )}
          <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-wide">
            Ice Actual
          </p>
        </div>
      </div>

      {/* Forecast badge for pre-storm */}
      {stormPhase === 'pre-storm' && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400/70 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Forecast data</span>
        </div>
      )}

      {/* Forecast conditions (if no live obs) */}
      {!obs && city.conditions?.shortForecast && (
        <div className="text-xs sm:text-sm text-slate-400 border-t border-slate-700/50 pt-2">
          <p className="truncate">{city.conditions.shortForecast}</p>
          {city.conditions.temperature && (
            <p className="text-slate-500 text-[10px] sm:text-xs">
              {city.conditions.temperature}°{city.conditions.temperatureUnit}
            </p>
          )}
        </div>
      )}

      {city.error && (
        <p className="text-[9px] sm:text-[10px] text-red-400/70 mt-2">Data may be incomplete</p>
      )}
    </div>
  );
}

export default function CityCards({ cities, stormPhase = 'pre-storm', userLocations = [] }) {
  if (!cities || cities.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">
        <p>No weather data available</p>
      </div>
    );
  }

  // Combine cities with user locations
  let allCities = [...cities];
  userLocations.forEach(userLoc => {
    const exists = allCities.some(c => c.id === userLoc.id);
    if (!exists) {
      allCities.push({ ...userLoc, isUserLocation: true });
    }
  });

  // Sort cities alphabetically by name
  const sortedCities = allCities.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-white">All Tracked Cities</h2>
        <span className="text-[10px] sm:text-xs text-slate-500">{sortedCities.length} locations</span>
      </div>
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {sortedCities.map(city => (
          <CityCard key={city.id} city={city} stormPhase={stormPhase} isUserLocation={city.isUserLocation} />
        ))}
      </div>
    </div>
  );
}
