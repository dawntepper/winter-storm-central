import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';

// Center of the storm coverage area
const CENTER = [37.5, -82];
const ZOOM = 5;

// Atmospheric color palette
const hazardColors = {
  snow: '#93C5FD',    // Softer winter sky blue
  ice: '#E879F9',     // Ominous fuchsia/purple
  mixed: '#94A3B8',   // Lighter slate
  none: '#475569'     // Slate
};

function MapController() {
  const map = useMap();

  useEffect(() => {
    map.scrollWheelZoom.disable();
  }, [map]);

  return null;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function CityMarker({ city, stormPhase }) {
  const color = hazardColors[city.hazardType] || hazardColors.none;
  const forecastSnow = city.forecast?.snowfall || 0;
  const forecastIce = city.forecast?.ice || 0;
  const observedSnow = city.observed?.snowfall || 0;
  const observedIce = city.observed?.ice || 0;
  const radius = Math.max(8, Math.min(20, 8 + forecastSnow + (forecastIce * 10)));

  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  const hasObserved = observedSnow > 0 || observedIce > 0;

  return (
    <CircleMarker
      center={[city.lat, city.lon]}
      radius={radius}
      pathOptions={{
        fillColor: color,
        fillOpacity: 0.7,
        color: '#94a3b8',
        weight: 1.5,
        opacity: 0.8
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        <div className="min-w-[160px]">
          {/* City name and last updated */}
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-semibold text-sm">{city.name}</h3>
            {city.lastUpdated && (
              <span className="text-[9px] text-gray-400">{formatTime(city.lastUpdated)}</span>
            )}
          </div>

          {/* Forecast Data */}
          <div className="mb-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[10px] text-gray-500 font-medium">FORECAST</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-blue-600">Snow:</span>{' '}
                <strong>{forecastSnow > 0 ? `${forecastSnow.toFixed(2)}"` : '-'}</strong>
              </div>
              <div>
                <span className="text-purple-600">Ice:</span>{' '}
                <strong>{forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}</strong>
              </div>
            </div>
          </div>

          {/* Observed Data (show during/after storm) */}
          {isActive && (
            <div className="border-t border-gray-200 pt-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-gray-500 font-medium">ACTUAL</span>
              </div>
              {hasObserved ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600">Snow:</span>{' '}
                    <strong className="text-emerald-600">{observedSnow.toFixed(2)}"</strong>
                  </div>
                  <div>
                    <span className="text-purple-600">Ice:</span>{' '}
                    <strong className="text-emerald-600">{observedIce.toFixed(2)}"</strong>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 italic">Accumulating...</p>
              )}
            </div>
          )}

          {/* Live conditions */}
          {city.observation && (
            <div className="border-t border-gray-200 pt-1.5 mt-1.5">
              <p className="text-[10px] text-emerald-600 font-medium">
                Live: {city.observation.temperature}°F, {city.observation.conditions}
              </p>
            </div>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  );
}

function UserLocationMarker({ location, stormPhase }) {
  const color = hazardColors[location.hazardType] || hazardColors.none;
  const forecastSnow = location.forecast?.snowfall || 0;
  const forecastIce = location.forecast?.ice || 0;
  const observedSnow = location.observed?.snowfall || 0;
  const observedIce = location.observed?.ice || 0;
  const radius = Math.max(10, Math.min(22, 10 + forecastSnow + (forecastIce * 10)));

  const isActive = stormPhase === 'active' || stormPhase === 'post-storm';
  const hasObserved = observedSnow > 0 || observedIce > 0;

  return (
    <CircleMarker
      center={[location.lat, location.lon]}
      radius={radius}
      pathOptions={{
        fillColor: color,
        fillOpacity: 0.8,
        color: '#10b981', // Emerald green outline
        weight: 3,
        opacity: 1
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        <div className="min-w-[160px]">
          {/* City name with Your Location badge */}
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-semibold text-sm">{location.name}</h3>
            <span className="text-[8px] bg-emerald-500 text-white px-1 py-0.5 rounded">You</span>
          </div>

          {/* Forecast Data */}
          <div className="mb-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[10px] text-gray-500 font-medium">EXPECTED</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-blue-600">Snow:</span>{' '}
                <strong>{forecastSnow > 0 ? `${forecastSnow.toFixed(2)}"` : '-'}</strong>
              </div>
              <div>
                <span className="text-purple-600">Ice:</span>{' '}
                <strong>{forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}</strong>
              </div>
            </div>
          </div>

          {/* Observed Data */}
          <div className="border-t border-gray-200 pt-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] text-gray-500 font-medium">ACCUMULATIONS</span>
            </div>
            {hasObserved ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-blue-600">Snow:</span>{' '}
                  <strong className="text-emerald-600">{observedSnow.toFixed(2)}"</strong>
                </div>
                <div>
                  <span className="text-purple-600">Ice:</span>{' '}
                  <strong className="text-emerald-600">{observedIce.toFixed(2)}"</strong>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 italic">No accumulation yet</p>
            )}
          </div>
        </div>
      </Tooltip>
    </CircleMarker>
  );
}

export default function StormMap({ weatherData, stormPhase = 'pre-storm', userLocation = null }) {
  const cities = Object.values(weatherData);

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
      <div className="bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-semibold text-white">Storm Coverage</h2>
          <span className={`text-[10px] px-2 py-1 rounded border ${
            stormPhase === 'pre-storm'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          }`}>
            {stormPhase === 'pre-storm' ? 'Forecast' : 'Live Tracking'}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-slate-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-sky-300"></span> Snow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-fuchsia-400"></span> Ice
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-slate-400"></span> Mixed
          </span>
          {userLocation && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-emerald-500 bg-transparent"></span> Your Location
            </span>
          )}
          <span className="ml-auto text-slate-600 hidden sm:inline">Hover for details</span>
        </div>
      </div>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        style={{ height: '300px', width: '100%' }}
        className="z-0 sm:!h-[400px]"
      >
        <MapController />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {cities.map(city => (
          <CityMarker key={city.id} city={city} stormPhase={stormPhase} />
        ))}
        {userLocation && (
          <UserLocationMarker location={userLocation} stormPhase={stormPhase} />
        )}
      </MapContainer>
    </div>
  );
}
