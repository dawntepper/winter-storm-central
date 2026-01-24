import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';

// Center of the storm coverage area
const CENTER = [37.5, -82];
const ZOOM = 5;

const hazardColors = {
  snow: '#3b82f6',    // blue
  ice: '#a855f7',     // purple
  mixed: '#6b7280',   // gray
  none: '#475569'     // slate
};

function MapController() {
  const map = useMap();

  useEffect(() => {
    // Disable scroll zoom for better UX
    map.scrollWheelZoom.disable();
  }, [map]);

  return null;
}

function CityMarker({ city }) {
  const color = hazardColors[city.hazardType] || hazardColors.none;
  const snow = city.forecast?.snowfall || city.snowfall || 0;
  const ice = city.forecast?.ice || city.ice || 0;
  const radius = Math.max(8, Math.min(20, 8 + snow + (ice * 10)));

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
        <div className="text-center min-w-[140px]">
          <h3 className="font-semibold text-sm mb-1">{city.name}</h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-blue-600">Snow:</span>{' '}
              <strong>{snow > 0 ? `${snow.toFixed(2)}"` : '-'}</strong>
            </div>
            <div>
              <span className="text-purple-600">Ice:</span>{' '}
              <strong>{ice > 0 ? `${ice.toFixed(2)}"` : '-'}</strong>
            </div>
          </div>
          {city.observation && (
            <p className="text-[10px] mt-1 text-emerald-600 font-medium">
              Live: {city.observation.temperature}°F, {city.observation.conditions}
            </p>
          )}
          {!city.observation && (
            <p className="text-[10px] mt-1 text-gray-500">
              {city.conditions?.shortForecast || 'N/A'}
            </p>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  );
}

export default function StormMap({ weatherData }) {
  const cities = Object.values(weatherData);

  return (
    <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Storm Coverage</h2>
          <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-400 border border-slate-600">
            Forecast Totals
          </span>
        </div>
        <div className="flex gap-4 text-xs text-slate-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Snow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Ice
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Mixed
          </span>
          <span className="ml-auto text-slate-600">Hover for details</span>
        </div>
      </div>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        style={{ height: '400px', width: '100%' }}
        className="z-0"
      >
        <MapController />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {cities.map(city => (
          <CityMarker key={city.id} city={city} />
        ))}
      </MapContainer>
    </div>
  );
}
