import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef, createContext, useContext } from 'react';
import L from 'leaflet';

// Context to share zoom level with marker components
const ZoomContext = createContext(5.5);

// Center of the storm coverage area - responsive defaults
// Adjusted to include Alaska in default view
const CENTER_DESKTOP = [45.0, -115]; // Shifted north and west to show Alaska
const CENTER_MOBILE = [42.0, -100];  // Centered for mobile
const ZOOM_DESKTOP = 3.2;  // Zoomed out to show Alaska + continental US
const ZOOM_MOBILE = 2.8;   // Zoomed out more on mobile to see full coverage

// Atmospheric color palette - more vibrant
const hazardColors = {
  snow: '#60A5FA',    // Brighter blue
  ice: '#E879F9',     // Vibrant fuchsia
  mixed: '#A78BFA',   // Purple blend
  none: '#64748B'     // Slate
};

// Glow colors for the outer ring
const glowColors = {
  snow: 'rgba(96, 165, 250, 0.4)',
  ice: 'rgba(232, 121, 249, 0.4)',
  mixed: 'rgba(167, 139, 250, 0.4)',
  none: 'rgba(100, 116, 139, 0.3)'
};

// Weather condition to icon mapping
const getWeatherIcon = (condition) => {
  if (!condition) return '⛅';
  const c = condition.toLowerCase();
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '❄️';
  if (c.includes('cold') || c.includes('freez')) return '🥶';
  if (c.includes('thunder') || c.includes('tstorm') || c.includes('storm')) return '⛈️';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haz')) return '🌫️';
  if (c.includes('wind') || c.includes('breez')) return '💨';
  if (c.includes('cloudy') || c.includes('overcast')) {
    if (c.includes('partly') || c.includes('mostly sunny')) return '⛅';
    return '☁️';
  }
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return '☀️';
  if (c.includes('partly')) return '⛅';
  return '⛅';
};

// Create custom label icon with zoom-aware offset
const createLabelIcon = (name, hazardType, isUser = false, zoomLevel = 5.5) => {
  // User locations get solid green labels with white text
  const bgColor = isUser ? '#10b981' : 'rgba(15, 23, 42, 0.9)';
  const textColor = isUser ? 'white' : 'white';
  const borderColor = isUser ? '#10b981' : hazardColors[hazardType] || hazardColors.none;
  const shadow = isUser
    ? '0 2px 12px rgba(0,0,0,0.4), 0 0 15px rgba(16, 185, 129, 0.4)'
    : '0 2px 8px rgba(0,0,0,0.6)';
  // Add text shadow for all labels (including user locations for better readability)
  const textShadow = '0 1px 3px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)';

  // Calculate offset based on zoom level
  // At zoom 5.5 (default), offset is -15
  // At higher zoom, offset increases to spread labels apart
  const baseOffset = -15;
  const zoomFactor = Math.max(0, zoomLevel - 5.5);
  const offset = baseOffset - (zoomFactor * 8); // Labels move up 8px per zoom level

  return L.divIcon({
    className: 'city-label-wrapper',
    html: `<div class="city-label" style="
      display: inline-block;
      background: ${bgColor};
      color: ${textColor};
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: ${isUser ? '700' : '600'};
      white-space: nowrap;
      border: 2px solid ${borderColor};
      box-shadow: ${shadow};
      text-shadow: ${textShadow};
      transform: translateX(-50%);
    ">${name}${isUser ? ' ★' : ''}</div>`,
    iconSize: null,
    iconAnchor: [0, offset]
  });
};

function MapController({ showRadar }) {
  const map = useMap();

  useEffect(() => {
    // Disable scroll wheel zoom to prevent accidental zoom when scrolling page
    map.scrollWheelZoom.disable();

    // Ensure dragging is enabled
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();

    // Smooth zoom
    map.options.zoomAnimation = true;
    map.options.fadeAnimation = true;
    map.options.markerZoomAnimation = true;

    // Re-enable map interactions after any click (fixes stuck state after marker click)
    const handleClick = () => {
      setTimeout(() => {
        map.dragging.enable();
        map.touchZoom.enable();
      }, 100);
    };

    map.on('click', handleClick);
    map.on('popupclose', handleClick);
    map.on('tooltipclose', handleClick);

    return () => {
      map.off('click', handleClick);
      map.off('popupclose', handleClick);
      map.off('tooltipclose', handleClick);
    };
  }, [map]);

  return null;
}

// Component to fit map bounds to user locations
function FitBoundsToLocations({ userLocations, triggerFit }) {
  const map = useMap();

  useEffect(() => {
    if (triggerFit && userLocations.length > 0) {
      // Create bounds from user locations
      const bounds = L.latLngBounds(
        userLocations.map(loc => [loc.lat, loc.lon])
      );

      // Add padding to the bounds so markers aren't at the edge
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 10, // Don't zoom in too far
        animate: true,
        duration: 0.5
      });
    }
  }, [triggerFit, userLocations, map]);

  return null;
}

// Reset map to default view (responsive)
function ResetMapView({ trigger }) {
  const map = useMap();

  useEffect(() => {
    if (trigger) {
      const isMobile = window.innerWidth < 768;
      const center = isMobile ? CENTER_MOBILE : CENTER_DESKTOP;
      const zoom = isMobile ? ZOOM_MOBILE : ZOOM_DESKTOP;
      map.setView(center, zoom, { animate: true, duration: 0.5 });
    }
  }, [trigger, map]);

  return null;
}

// Center map on user's geolocation
function CenterOnGeolocation({ trigger, onLocated, onError }) {
  const map = useMap();

  useEffect(() => {
    if (trigger) {
      if (!navigator.geolocation) {
        onError('Geolocation not supported by your browser');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 8, { animate: true, duration: 0.5 });
          onLocated({ lat: latitude, lon: longitude });
        },
        (error) => {
          let message = 'Unable to get your location';
          if (error.code === 1) message = 'Location access denied';
          if (error.code === 2) message = 'Location unavailable';
          if (error.code === 3) message = 'Location request timed out';
          onError(message);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, [trigger, map, onLocated, onError]);

  return null;
}

// Center map on a specific location with responsive offset
function CenterOnLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location && location.lat && location.lon) {
      const isMobile = window.innerWidth < 768;

      // Small offset to place city slightly above center (negative = city appears higher)
      // Keep it minimal so city stays well within view
      const latOffset = isMobile ? 0.1 : -0.2;
      const adjustedLat = location.lat + latOffset;

      map.setView([adjustedLat, location.lon], 7, { animate: true, duration: 0.5 });
    }
  }, [location?.id, location?.lat, location?.lon, map]);

  return null;
}

// Component to track zoom level and update context
function ZoomTracker({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });

  // Set initial zoom
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

// Radar layer component using RainViewer API
function RadarLayer({ show }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    // Clean up existing layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!show) return;

    // Fetch latest radar timestamp from RainViewer
    const fetchRadar = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        const host = data.host || 'https://tilecache.rainviewer.com';
        const latest = data.radar?.past?.slice(-1)[0];

        if (latest && show) {
          // Remove existing layer before adding new one
          if (layerRef.current) {
            map.removeLayer(layerRef.current);
          }

          // Color scheme 4 = "The Weather Channel" style (more vibrant)
          // Options: 1_1 = smooth radar with snow detection
          const layer = L.tileLayer(
            `${host}${latest.path}/256/{z}/{x}/{y}/4/1_1.png`,
            {
              opacity: 0.7,
              zIndex: 400,
              tileSize: 256,
              attribution: '<a href="https://rainviewer.com">RainViewer</a>'
            }
          );

          layer.addTo(map);
          layerRef.current = layer;
        }
      } catch (err) {
        console.error('Radar fetch error:', err);
      }
    };

    fetchRadar();

    // Refresh radar every 5 minutes
    const interval = setInterval(fetchRadar, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [show, map]);

  return null;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}


// Enhanced city marker with glow effect
function CityMarker({ city, stormPhase, isMobile = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const zoomLevel = useContext(ZoomContext);
  const color = hazardColors[city.hazardType] || hazardColors.none;
  const glowColor = glowColors[city.hazardType] || glowColors.none;
  const forecastSnow = city.forecast?.snowfall || 0;
  const forecastIce = city.forecast?.ice || 0;

  const position = [city.lat, city.lon];

  // Mobile: uniform size for readability. Desktop: scale by forecast
  const baseRadius = isMobile ? 10 : Math.max(12, Math.min(30, 12 + forecastSnow * 1.5 + (forecastIce * 15)));
  const radius = isHovered ? baseRadius * 1.2 : baseRadius;

  // Recreate label icon when zoom changes
  const labelIcon = useMemo(() => createLabelIcon(city.name.split(',')[0], city.hazardType, false, zoomLevel), [city.name, city.hazardType, zoomLevel]);

  return (
    <>
      {/* Outer glow ring */}
      <CircleMarker
        center={[city.lat, city.lon]}
        radius={radius + (isMobile ? 4 : 8)}
        pathOptions={{
          fillColor: glowColor,
          fillOpacity: 0.5,
          color: 'transparent',
          weight: 0
        }}
        className="pulse-marker"
      />

      {/* Main marker */}
      <CircleMarker
        center={position}
        radius={radius}
        pathOptions={{
          fillColor: color,
          fillOpacity: 0.85,
          color: '#ffffff',
          weight: 2.5,
          opacity: 0.9
        }}
        eventHandlers={{
          mouseover: () => setIsHovered(true),
          mouseout: () => setIsHovered(false)
        }}
      >
        <Tooltip
          direction="top"
          offset={[0, -15]}
          opacity={0.98}
          className="enhanced-tooltip"
        >
          <div className="min-w-[180px] p-1">
            {/* City name header */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200">
              <h3 className="font-bold text-sm text-gray-800">{city.name}</h3>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                city.hazardType === 'snow' ? 'bg-blue-100 text-blue-700' :
                city.hazardType === 'ice' ? 'bg-purple-100 text-purple-700' :
                city.hazardType === 'mixed' ? 'bg-violet-100 text-violet-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {city.hazardType.toUpperCase()}
              </span>
            </div>

            {/* Current conditions */}
            {city.observation?.temperature && (
              <div className="flex items-center gap-2 mb-2 p-1.5 bg-emerald-50 rounded">
                <span className="text-lg font-bold text-emerald-700">{city.observation.temperature}°F</span>
                <span className="text-[10px] text-emerald-600">{city.observation.conditions}</span>
              </div>
            )}

            {/* Forecast Data */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">NOAA Forecast</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-blue-50 rounded p-1.5 text-center">
                  <div className="text-blue-700 font-bold text-sm">
                    {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                  </div>
                  <div className="text-[9px] text-blue-500">Snow</div>
                </div>
                <div className="bg-purple-50 rounded p-1.5 text-center">
                  <div className="text-purple-700 font-bold text-sm">
                    {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                  </div>
                  <div className="text-[9px] text-purple-500">Ice</div>
                </div>
              </div>
            </div>

            {city.lastUpdated && (
              <div className="text-[9px] text-gray-400 text-right mt-2 pt-1 border-t border-gray-100">
                Updated {formatTime(city.lastUpdated)}
              </div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>

      {/* City label - also interactive for easier hovering */}
      <Marker
        position={[city.lat, city.lon]}
        icon={labelIcon}
        eventHandlers={{
          mouseover: () => setIsHovered(true),
          mouseout: () => setIsHovered(false)
        }}
      >
        <Tooltip
          direction="top"
          offset={[0, -30]}
          opacity={0.98}
          className="enhanced-tooltip"
        >
          <div className="min-w-[180px] p-1">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200">
              <h3 className="font-bold text-sm text-gray-800">{city.name}</h3>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                city.hazardType === 'snow' ? 'bg-blue-100 text-blue-700' :
                city.hazardType === 'ice' ? 'bg-purple-100 text-purple-700' :
                city.hazardType === 'mixed' ? 'bg-violet-100 text-violet-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {city.hazardType.toUpperCase()}
              </span>
            </div>
            {city.observation?.temperature && (
              <div className="flex items-center gap-2 mb-2 p-1.5 bg-emerald-50 rounded">
                <span className="text-lg font-bold text-emerald-700">{city.observation.temperature}°F</span>
                <span className="text-[10px] text-emerald-600">{city.observation.conditions}</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">NOAA Forecast</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-blue-50 rounded p-1.5 text-center">
                  <div className="text-blue-700 font-bold text-sm">
                    {forecastSnow > 0 ? `${forecastSnow.toFixed(1)}"` : '-'}
                  </div>
                  <div className="text-[9px] text-blue-500">Snow</div>
                </div>
                <div className="bg-purple-50 rounded p-1.5 text-center">
                  <div className="text-purple-700 font-bold text-sm">
                    {forecastIce > 0 ? `${forecastIce.toFixed(2)}"` : '-'}
                  </div>
                  <div className="text-[9px] text-purple-500">Ice</div>
                </div>
              </div>
            </div>
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}

// Enhanced user location marker
function UserLocationMarker({ location, stormPhase, isMobile = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const zoomLevel = useContext(ZoomContext);
  const color = hazardColors[location.hazardType] || hazardColors.none;
  const forecastSnow = location.forecast?.snowfall || 0;
  const forecastIce = location.forecast?.ice || 0;

  const position = [location.lat, location.lon];

  // Fixed small size for clean, consistent appearance
  const baseRadius = 8;
  const radius = isHovered ? baseRadius * 1.2 : baseRadius;

  // Recreate label icon when zoom changes
  const labelIcon = useMemo(() => createLabelIcon(location.name.split(',')[0], location.hazardType, true, zoomLevel), [location.name, location.hazardType, zoomLevel]);

  return (
    <>
      {/* Outer glow - green for user locations (non-interactive to allow map dragging) */}
      <CircleMarker
        center={position}
        radius={radius + 4}
        pathOptions={{
          fillColor: '#10b981',
          fillOpacity: 0.35,
          color: 'transparent',
          weight: 0,
          interactive: false
        }}
      />

      {/* Main marker - gray fill with green border */}
      <CircleMarker
        center={position}
        radius={radius}
        pathOptions={{
          fillColor: '#475569',
          fillOpacity: 0.9,
          color: '#10b981',
          weight: 3,
          opacity: 1,
          bubblingMouseEvents: true
        }}
        eventHandlers={{
          mouseover: () => setIsHovered(true),
          mouseout: () => setIsHovered(false)
        }}
      >
        <Tooltip direction="top" offset={[0, -15]} opacity={0.98} className="enhanced-tooltip">
          <div className="min-w-[200px] p-3">
            {/* Line 1: Weather icon + City name */}
            <h3 className="font-bold text-lg text-gray-800 mb-2">
              {getWeatherIcon(location.conditions?.shortForecast)} {location.name}
            </h3>

            {/* Line 2: Alert status */}
            <div className="mb-1">
              {location.alertInfo ? (
                <span className="text-sm text-orange-500">⚠️ {location.alertInfo.event}</span>
              ) : (
                <span className="text-sm text-cyan-600">✓ No active alerts</span>
              )}
            </div>

            {/* Line 3: Temperature · Condition */}
            <div className="text-sm text-gray-500">
              {location.conditions?.temperature ? (
                <span>{location.conditions.temperature}°{location.conditions.temperatureUnit || 'F'} · {location.conditions.shortForecast || 'No data'}</span>
              ) : location.alertInfo ? (
                <span>Tap location in sidebar for details</span>
              ) : (
                <span>Weather data unavailable</span>
              )}
            </div>
          </div>
        </Tooltip>
      </CircleMarker>

      {/* City label - also interactive for easier hovering */}
      <Marker
        position={[location.lat, location.lon]}
        icon={labelIcon}
        eventHandlers={{
          mouseover: () => setIsHovered(true),
          mouseout: () => setIsHovered(false)
        }}
      >
        <Tooltip direction="top" offset={[0, -30]} opacity={0.98} className="enhanced-tooltip">
          <div className="min-w-[200px] p-3">
            {/* Line 1: Weather icon + City name */}
            <h3 className="font-bold text-lg text-gray-800 mb-2">
              {getWeatherIcon(location.conditions?.shortForecast)} {location.name}
            </h3>

            {/* Line 2: Alert status */}
            <div className="mb-1">
              {location.alertInfo ? (
                <span className="text-sm text-orange-500">⚠️ {location.alertInfo.event}</span>
              ) : (
                <span className="text-sm text-cyan-600">✓ No active alerts</span>
              )}
            </div>

            {/* Line 3: Temperature · Condition */}
            <div className="text-sm text-gray-500">
              {location.conditions?.temperature ? (
                <span>{location.conditions.temperature}°{location.conditions.temperatureUnit || 'F'} · {location.conditions.shortForecast || 'No data'}</span>
              ) : location.alertInfo ? (
                <span>Tap location in sidebar for details</span>
              ) : (
                <span>Weather data unavailable</span>
              )}
            </div>
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}

// Preview marker - just a green label, no circle (shown before user clicks Add)
function PreviewMarker({ location }) {
  if (!location) return null;

  const position = [location.lat, location.lon];
  const cityName = location.name?.split(',')[0] || location.name;

  // Create white label icon for high visibility on dark map
  const labelIcon = L.divIcon({
    className: 'city-label-wrapper',
    html: `<div class="city-label" style="
      display: inline-block;
      background: rgba(255, 255, 255, 0.95);
      color: #1e293b;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 12px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3);
      transform: translateX(-50%);
    ">${cityName}</div>`,
    iconSize: null,
    iconAnchor: [0, 0]
  });

  return <Marker position={position} icon={labelIcon} />;
}

export default function StormMap({ weatherData, stormPhase = 'pre-storm', userLocations = [], isHero = false, isSidebar = false, centerOn = null, previewLocation = null }) {
  const [showRadar, setShowRadar] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zoomLevel, setZoomLevel] = useState(isMobile ? ZOOM_MOBILE : ZOOM_DESKTOP);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [geoTrigger, setGeoTrigger] = useState(0);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [userGeoLocation, setUserGeoLocation] = useState(null);
  const cities = Object.values(weatherData);

  // Initial center/zoom based on screen size
  const initialCenter = isMobile ? CENTER_MOBILE : CENTER_DESKTOP;
  const initialZoom = isMobile ? ZOOM_MOBILE : ZOOM_DESKTOP;

  // Track window resize for responsive marker sizing
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoomToLocations = () => {
    setFitTrigger(prev => prev + 1);
    // Track My Locations viewed
    if (window.plausible) {
      window.plausible('My Locations Viewed');
    }
  };

  const handleResetView = () => {
    setResetTrigger(prev => prev + 1);
  };

  const handleMyLocation = () => {
    setGeoLoading(true);
    setGeoError(null);
    setGeoTrigger(prev => prev + 1);
  };

  const handleGeoLocated = (coords) => {
    setGeoLoading(false);
    setUserGeoLocation(coords);
    // Track geolocation use
    if (window.plausible) {
      window.plausible('My Location Used');
    }
  };

  const handleGeoError = (message) => {
    setGeoLoading(false);
    setGeoError(message);
    // Clear error after 3 seconds
    setTimeout(() => setGeoError(null), 3000);
  };

  return (
    <div className={`bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl ${isHero ? 'ring-2 ring-slate-600/50 shadow-slate-900/50' : ''} ${isSidebar ? 'h-full flex flex-col' : ''}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <h2 className={`font-bold text-white ${isHero ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
              Storm Coverage
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Reset view button */}
            <button
              onClick={handleResetView}
              className="px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300 cursor-pointer"
              title="Reset to default US view"
            >
              Reset View
            </button>
            {/* Radar toggle */}
            <button
              onClick={() => {
                setShowRadar(!showRadar);
                // Track radar toggle
                if (window.plausible) {
                  window.plausible('Radar Toggled');
                }
              }}
              className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                showRadar
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {showRadar ? '✓ Radar On' : 'Show Radar'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-[10px] sm:text-xs text-slate-400 mt-3">
          {showRadar && (
            <span className="flex items-center gap-2 text-cyan-400">
              <span className="w-3 h-3 rounded bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"></span> Radar
            </span>
          )}
          {geoError && (
            <span className="text-red-400 text-[10px]">{geoError}</span>
          )}
          <span className="ml-auto text-slate-500 hidden sm:inline">
            Click an alert to preview on map
          </span>
        </div>
      </div>

      {/* Map Container - fills available height in sidebar mode */}
      <div className={`relative ${isSidebar ? 'flex-1 min-h-[400px]' : ''}`}>
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ height: isSidebar ? '100%' : (isHero ? '500px' : '350px'), width: '100%' }}
          className={`z-0 ${!isSidebar && isHero ? 'sm:!h-[600px] lg:!h-[700px]' : ''} ${!isSidebar && !isHero ? 'sm:!h-[450px]' : ''}`}
          zoomControl={true}
        >
          <MapController showRadar={showRadar} />
          <ZoomTracker onZoomChange={setZoomLevel} />
          <FitBoundsToLocations userLocations={userLocations} triggerFit={fitTrigger} />
          <ResetMapView trigger={resetTrigger} />
          <CenterOnLocation location={centerOn} />
          <CenterOnGeolocation trigger={geoTrigger} onLocated={handleGeoLocated} onError={handleGeoError} />

          {/* Dark Matter basemap */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Radar overlay */}
          <RadarLayer show={showRadar} />

          {/* Markers with zoom context */}
          <ZoomContext.Provider value={zoomLevel}>
            {/* User location markers - green circles with labels */}
            {userLocations.map((location) => (
              <UserLocationMarker
                key={location.id}
                location={location}
                stormPhase={stormPhase}
                isMobile={isMobile}
              />
            ))}

            {/* Preview marker for extreme weather alerts */}
            {previewLocation && (
              <PreviewMarker location={previewLocation} />
            )}
          </ZoomContext.Provider>
        </MapContainer>

        {/* Gradient overlay at edges for polish */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-900/30 to-transparent"></div>
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/30 to-transparent"></div>
        </div>
      </div>

      {/* Custom styles for pulse animation and labels */}
      <style>{`
        .pulse-marker {
          animation: pulse 2s ease-in-out infinite;
        }
        .pulse-marker-user {
          animation: pulse-user 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes pulse-user {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        .leaflet-tooltip.enhanced-tooltip {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          padding: 8px;
        }
        .leaflet-tooltip.enhanced-tooltip::before {
          border-top-color: #f8fafc;
        }
        .city-label-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .city-label-wrapper .city-label {
          box-sizing: border-box;
        }
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
