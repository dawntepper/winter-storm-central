import { MapContainer, TileLayer, CircleMarker, Marker, GeoJSON, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState, useMemo, useRef, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { STATE_GEOJSON } from '../data/stateGeoJSON';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';
import { getCitySlugForLocation } from '../utils/cityLookup';
import { ABBR_TO_SLUG } from '../data/stateConfig';
import StateAlertsDropdown from './StateAlertsDropdown';
import {
  trackRadarToggle,
  trackAlertsToggle,
  trackMapReset,
  trackMapAlertClicked,
  trackAlertDetailView,
  trackGeolocationUsed,
  setNavSource,
  NAV_SOURCES,
  SAVE_TRIGGERS
} from '../utils/analytics';

/**
 * Full Alert Modal - shows complete alert details
 */
function AlertModal({ alert, onClose }) {
  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-amber-900/30 border-b border-amber-500/30 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-amber-200">{alert.event}</h3>
            <p className="text-sm text-slate-400">{alert.location}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {alert.headline && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline</h4>
              <p className="text-sm text-amber-200">{alert.headline}</p>
            </div>
          )}

          {alert.fullDescription && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Details</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{alert.fullDescription}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700">
            {alert.severity && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Severity</h4>
                <p className="text-sm text-slate-300">{alert.severity}</p>
              </div>
            )}
            {alert.urgency && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Urgency</h4>
                <p className="text-sm text-slate-300">{alert.urgency}</p>
              </div>
            )}
            {alert.onset && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Starts</h4>
                <p className="text-sm text-slate-300">{new Date(alert.onset).toLocaleString()}</p>
              </div>
            )}
            {alert.expires && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Expires</h4>
                <p className="text-sm text-slate-300">{new Date(alert.expires).toLocaleString()}</p>
              </div>
            )}
          </div>

          {alert.areaDesc && (
            <div className="pt-2 border-t border-slate-700">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Affected Areas</h4>
              <p className="text-xs text-slate-400">{alert.areaDesc}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center">
          <a
            href="https://www.weather.gov/alerts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            View all alerts on Weather.gov →
          </a>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Context to share zoom level with marker components
const ZoomContext = createContext(5.5);

// Center of the storm coverage area - responsive defaults
// Desktop default frames the lower-48 closeup (Alaska/Hawaii still on the map,
// just outside the initial viewport — users can pan/zoom to them).
const CENTER_DESKTOP = [39.5, -96]; // Geographic center of the contiguous US
const CENTER_MOBILE = [42.0, -100];  // Centered for mobile
const ZOOM_DESKTOP = 4.2;  // One step tighter — CONUS closeup, no Alaska in frame
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
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Disable scroll wheel zoom to prevent accidental zoom when scrolling page
    map.scrollWheelZoom.disable();

    if (isTouchDevice) {
      // On touch: disable one-finger drag so page scrolls normally
      map.dragging.disable();
      // Keep two-finger pinch zoom enabled
      map.touchZoom.enable();
    } else {
      map.dragging.enable();
    }
    map.doubleClickZoom.enable();

    // Smooth zoom
    map.options.zoomAnimation = true;
    map.options.fadeAnimation = true;
    map.options.markerZoomAnimation = true;

    // Re-enable map interactions after any click (fixes stuck state after marker click)
    const handleClick = () => {
      setTimeout(() => {
        if (!isTouchDevice) map.dragging.enable();
        map.touchZoom.enable();
      }, 100);
    };

    map.on('click', handleClick);
    map.on('popupclose', handleClick);
    map.on('tooltipclose', handleClick);

    // Two-finger gesture detection for hint overlay
    // Only show hint when user tries to drag (single-finger move), not on taps
    const container = map.getContainer();
    let touchTimeout;
    let startTouch = null;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        map.dragging.enable();
        container.classList.remove('show-gesture-hint');
      } else if (e.touches.length === 1) {
        startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && startTouch) {
        const dx = Math.abs(e.touches[0].clientX - startTouch.x);
        const dy = Math.abs(e.touches[0].clientY - startTouch.y);
        // Only show hint if user moved finger enough to indicate a drag attempt
        if (dx > 10 || dy > 10) {
          container.classList.add('show-gesture-hint');
          clearTimeout(touchTimeout);
          touchTimeout = setTimeout(() => {
            container.classList.remove('show-gesture-hint');
          }, 1500);
          startTouch = null; // Only show once per gesture
        }
      }
    };

    const handleTouchEnd = () => {
      startTouch = null;
      if (isTouchDevice) {
        setTimeout(() => map.dragging.disable(), 300);
      }
    };

    if (isTouchDevice) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      map.off('click', handleClick);
      map.off('popupclose', handleClick);
      map.off('tooltipclose', handleClick);
      clearTimeout(touchTimeout);
      if (isTouchDevice) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
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

      // Use provided zoom level or default to 7
      const zoomLevel = location.zoom || 7;

      map.setView([adjustedLat, location.lon], zoomLevel, { animate: true, duration: 0.5 });
    }
  }, [location?.id, location?.lat, location?.lon, location?.zoom, map]);

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

// Radar layer types - exported for use by RadarPage controls
export const RADAR_LAYER_TYPES = {
  precipitation: 'precipitation',
  satellite: 'satellite',
  forecast: 'forecast'
};

// Color scheme options for precipitation radar (RainViewer tile API).
// Keys MUST match RainViewer's documented scheme numbering — they're
// interpolated directly into the tile URL. See rainviewer.com/api.html.
// Default value (4 = The Weather Channel) is preserved from before the
// label fix, so users see the same visual treatment.
export const RADAR_COLOR_SCHEMES = {
  0: 'Black & White',
  1: 'Original',
  2: 'Universal Blue',
  3: 'TITAN',
  4: 'The Weather Channel',
  5: 'Meteored',
  6: 'NEXRAD Level III',
  7: 'Rainbow',
  8: 'Dark Sky',
};

// GIBS WMTS time dimension. Computed timestamps often 404 when the frame
// isn't published yet; "default" resolves to the latest available imagery.
const GIBS_TIME = 'default';

// Radar/satellite layer component
// - precipitation: RainViewer (past radar with color scheme support)
// - satellite: NASA GIBS GOES-East GeoColor (true color day, IR night)
// - infrared: NASA GIBS GOES-East Clean Infrared (cloud tops)
const RADAR_PANE = 'radar-overlay';

function RadarLayer({ show, layerType = 'precipitation', colorScheme = 4, onLoadingChange }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    // Dedicated pane so we can fade the WHOLE radar layer in at once via the
    // pane's opacity, instead of tiles popping in one-by-one (the "choppy"
    // look). The pane stays hidden until the layer's 'load' fires, then eases
    // in. CSS transition lives in .radar-overlay-pane.
    let pane = map.getPane(RADAR_PANE);
    if (!pane) {
      pane = map.createPane(RADAR_PANE);
      pane.style.zIndex = 400;
      pane.classList.add('radar-overlay-pane');
    }
    const revealRadar = () => { pane.style.opacity = '1'; };
    const hideRadar = () => { pane.style.opacity = '0'; };

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!show) {
      onLoadingChange?.(false);
      hideRadar();
      return;
    }

    // Show the spinner up front — covers the gap before tiles begin loading
    // (notably the RainViewer JSON fetch on the precipitation path). The
    // layer's 'load' event clears it once the imagery is actually painted.
    onLoadingChange?.(true);
    hideRadar(); // start hidden; reveal (faded) once tiles finish on this pull-in

    const addLayer = (url, options = {}) => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      const layer = L.tileLayer(url, {
        opacity: 0.7,
        tileSize: 256,
        pane: RADAR_PANE,
        ...options,
      });
      // On load: clear the spinner and fade the radar in. We only listen for
      // 'load' (not 'loading'): the spinner/fade are armed once per pull-in at
      // the top of the effect, so pan/zoom tile reloads don't re-flash them —
      // only the initial load, a radar toggle, or a layer/color change does.
      layer.on('load', () => { onLoadingChange?.(false); revealRadar(); });
      layer.addTo(map);
      layerRef.current = layer;
    };

    let cancelled = false;

    if (layerType === 'satellite') {
      // NASA GIBS GOES-East GeoColor — true color (day) / blended IR (night)
      addLayer(
        `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/${GIBS_TIME}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`,
        {
          subdomains: 'abc',
          maxNativeZoom: 7,
          maxZoom: 18,
          attribution: 'NASA GIBS / NOAA GOES',
        }
      );
    } else if (layerType === 'infrared') {
      // NASA GIBS GOES-East Clean Infrared — cloud top temperatures
      addLayer(
        `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/${GIBS_TIME}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        {
          subdomains: 'abc',
          maxNativeZoom: 6,
          maxZoom: 18,
          attribution: 'NASA GIBS / NOAA GOES',
        }
      );
    } else {
      // Precipitation: RainViewer (latest past radar frame)
      const fetchRadar = async () => {
        try {
          const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
          const data = await response.json();
          if (cancelled) return;
          const host = data.host || 'https://tilecache.rainviewer.com';
          const latest = data.radar?.past?.slice(-1)[0];
          if (latest && show) {
            addLayer(
              `${host}${latest.path}/256/{z}/{x}/{y}/${colorScheme}/1_1.png`,
              {
                attribution: '<a href="https://rainviewer.com">RainViewer</a>',
                maxNativeZoom: 7,
                maxZoom: 18,
              }
            );
          } else {
            onLoadingChange?.(false); // no frame to show — don't leave the spinner hanging
          }
        } catch (err) {
          console.error('Radar fetch error:', err);
          onLoadingChange?.(false);
        }
      };
      fetchRadar();
    }

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      if (cancelled) return;
      if (layerType === 'satellite' || layerType === 'infrared') {
        const url = layerType === 'satellite'
          ? `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/${GIBS_TIME}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.jpg`
          : `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/${GIBS_TIME}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
        addLayer(url, {
          subdomains: 'abc',
          maxNativeZoom: layerType === 'satellite' ? 7 : 6,
          maxZoom: 18,
          attribution: 'NASA GIBS / NOAA GOES',
        });
      } else {
        (async () => {
          try {
            const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await response.json();
            if (cancelled) return;
            const host = data.host || 'https://tilecache.rainviewer.com';
            const latest = data.radar?.past?.slice(-1)[0];
            if (latest) {
              addLayer(
                `${host}${latest.path}/256/{z}/{x}/{y}/${colorScheme}/1_1.png`,
                {
                  attribution: '<a href="https://rainviewer.com">RainViewer</a>',
                  maxNativeZoom: 7,
                  maxZoom: 18,
                }
              );
            }
          } catch (err) {
            console.error('Radar refresh error:', err);
          }
        })();
      }
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      onLoadingChange?.(false);
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [show, map, layerType, colorScheme, onLoadingChange]);

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

// Enhanced user location marker with sticky hover support
function UserLocationMarker({ location, stormPhase, isMobile = false, onHover, onLeave }) {
  const zoomLevel = useContext(ZoomContext);

  const position = [location.lat, location.lon];
  const baseRadius = 8;

  // Recreate label icon when zoom changes
  const labelIcon = useMemo(() => createLabelIcon(location.name.split(',')[0], location.hazardType, true, zoomLevel), [location.name, location.hazardType, zoomLevel]);

  return (
    <>
      {/* Outer glow - green for user locations (non-interactive to allow map dragging) */}
      <CircleMarker
        center={position}
        radius={baseRadius + 4}
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
        radius={baseRadius}
        pathOptions={{
          fillColor: '#475569',
          fillOpacity: 0.9,
          color: '#10b981',
          weight: 3,
          opacity: 1,
          bubblingMouseEvents: true
        }}
        eventHandlers={{
          mouseover: (e) => onHover(location, e),
          mouseout: onLeave
        }}
      />

      {/* City label */}
      <Marker
        position={[location.lat, location.lon]}
        icon={labelIcon}
        eventHandlers={{
          mouseover: (e) => onHover(location, e),
          mouseout: onLeave
        }}
      />
    </>
  );
}

// Alert category colors for dots (and pill backgrounds in the legend below)
const alertCategoryColors = {
  tornado: '#dc2626',  // deep red — most life-threatening, distinct from severe
  tropical: '#0ea5e9', // bright azure — reads on the dark map (was #1e3a8a navy)
  severe: '#ef4444',   // red
  winter: '#3b82f6',   // blue
  flood: '#06b6d4',    // cyan - matches flooding card
  heat: '#f97316',     // orange
  fire: '#92400e',     // brown
  default: '#ef4444'   // red fallback
};

// Simple alert dot marker with highlight and selected support
function AlertDotMarker({ alert, onHover, onLeave, onClick, highlighted = false, selected = false, shouldPulse = false }) {
  const position = [alert.lat, alert.lon];
  const baseColor = alertCategoryColors[alert.category] || alertCategoryColors.default;
  // Green when selected, otherwise use category color
  const color = selected ? '#10b981' : baseColor;

  // Tornado Watch dots render as a hollow ring (red border, transparent center)
  // — meaning: "tornadoes possible" (potential), distinct from Severe Warning's
  // "severe storm happening" (current) which uses a filled red dot.
  const isTornadoWatch =
    alert.category === 'tornado' && (alert.event || '').includes('Watch');

  // Active Tornado Warnings get a custom divIcon: red filled circle with a 🌪
  // emoji overlay, plus a pulse animation for the top-20 most-severe (see
  // TORNADO_WARNING_PULSE_CAP in StormMap). The emoji is reserved for Warnings
  // only — it carries the "take shelter now" signal and would be diluted if
  // applied to Watches. Selected state falls through to the green CircleMarker
  // treatment below for consistency with how selection works for other alerts.
  const isTornadoWarning =
    alert.category === 'tornado' && (alert.event || '').includes('Warning');
  if (isTornadoWarning && !selected) {
    const pulseClass = shouldPulse ? ' tornado-warning-marker-pulse' : '';
    const icon = L.divIcon({
      html: `<div class="tornado-warning-marker${pulseClass}" role="img" aria-label="Tornado Warning"><span aria-hidden="true">🌪️</span></div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    return (
      <Marker
        position={position}
        icon={icon}
        eventHandlers={{
          mouseover: (e) => onHover(alert, e),
          mouseout: onLeave,
          click: (e) => onClick(alert, e)
        }}
      />
    );
  }

  // Tropical alerts (hurricane/tropical storm/storm surge) get the same
  // emoji-in-circle treatment as Tornado Warnings — a filled azure circle with
  // the 🌀 icon — so they read clearly on the dark map instead of as a small
  // dark-blue dot. No pulse: tropical systems are slower-moving than the
  // "take shelter now" tornado signal, so the static circle suffices. Selected
  // state falls through to the green CircleMarker treatment below.
  const isTropical = alert.category === 'tropical';
  if (isTropical && !selected) {
    const icon = L.divIcon({
      html: `<div class="tropical-alert-marker" role="img" aria-label="${alert.event || 'Tropical alert'}"><span aria-hidden="true">🌀</span></div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    return (
      <Marker
        position={position}
        icon={icon}
        eventHandlers={{
          mouseover: (e) => onHover(alert, e),
          mouseout: onLeave,
          click: (e) => onClick(alert, e)
        }}
      />
    );
  }

  return (
    <>
      {/* Pulsing outer ring - larger and more prominent when highlighted or selected.
          Watch dots get a dimmer halo so they read as quieter than Warnings. */}
      <CircleMarker
        center={position}
        radius={selected ? 20 : (highlighted ? 18 : 12)}
        pathOptions={{
          fillColor: color,
          fillOpacity: selected
            ? 0.5
            : (highlighted ? 0.5 : (isTornadoWatch ? 0.12 : 0.3)),
          color: 'transparent',
          weight: 0
        }}
        className={selected ? 'pulse-marker-selected' : (highlighted ? 'pulse-marker-highlighted' : 'pulse-marker')}
      />
      {/* Main dot marker - filled for everything except Tornado Watch, which
          renders as a hollow ring. Selected state always overrides to filled green. */}
      <CircleMarker
        center={position}
        radius={selected ? 10 : (highlighted ? 9 : 7)}
        pathOptions={{
          fillColor: isTornadoWatch && !selected ? 'transparent' : color,
          fillOpacity: isTornadoWatch && !selected ? 0 : 0.9,
          color: isTornadoWatch && !selected ? color : '#ffffff',
          weight: isTornadoWatch && !selected ? 3 : (selected ? 3 : (highlighted ? 3 : 2))
        }}
        eventHandlers={{
          mouseover: (e) => onHover(alert, e),
          mouseout: onLeave,
          click: (e) => onClick(alert, e)
        }}
      />
    </>
  );
}

// Highlighted state border outline when a state is selected
function StateBorderHighlight({ stateCode }) {
  if (!stateCode || !STATE_GEOJSON[stateCode]) return null;

  const geoData = STATE_GEOJSON[stateCode];

  return (
    <GeoJSON
      key={stateCode}
      data={geoData}
      interactive={false}
      style={{
        color: '#ffffff',
        weight: 3,
        opacity: 0.9,
        fillColor: '#ffffff',
        fillOpacity: 0.06,
      }}
    />
  );
}

// Fit map to a highlighted county polygon once GeoJSON is available. Runs after
// CenterOnLocation so the outline fits with padding instead of a tight point zoom.
function FitBoundsToHighlight({ geojson }) {
  const map = useMap();
  const areaKey = geojson?.properties?.name && geojson?.properties?.state
    ? `${geojson.properties.state}-${geojson.properties.name}`
    : null;

  useEffect(() => {
    if (!geojson?.geometry) return;
    try {
      const bounds = L.geoJSON(geojson).getBounds();
      if (!bounds.isValid()) return;
      const isMobile = window.innerWidth < 768;
      map.fitBounds(bounds, {
        padding: isMobile ? [40, 40] : [60, 60],
        maxZoom: 9,
        animate: true,
        duration: 0.5,
      });
    } catch {
      // Non-fatal — CenterOnLocation fallback zoom still applies
    }
  }, [areaKey, geojson, map]);

  return null;
}

// "Your area" county polygon — passed as a GeoJSON Feature (from NWS zone
// geometry). Emerald, so it reads as distinct from the white state border it
// sits inside. Re-keyed by county name so react-leaflet swaps layers on change.
// When onAreaClick is provided, the polygon becomes a button to the state
// alerts page (Leaflet gives interactive paths a pointer cursor by default).
function AreaHighlight({ geojson, onAreaClick }) {
  if (!geojson?.geometry) return null;

  const county = geojson.properties?.name;
  const stateAbbr = geojson.properties?.state;
  const areaKey = county && stateAbbr ? `${stateAbbr}-${county}` : county || 'user-area';
  const clickable = Boolean(onAreaClick && stateAbbr);
  const label = county
    ? `${county} County${stateAbbr ? ` · View ${stateAbbr} alerts →` : ''}`
    : stateAbbr
      ? `View ${stateAbbr} alerts →`
      : null;

  return (
    <GeoJSON
      key={areaKey}
      data={geojson}
      interactive={clickable}
      eventHandlers={clickable ? { click: () => onAreaClick(geojson) } : undefined}
      style={{
        color: '#34d399',
        weight: 2,
        opacity: 0.95,
        fillColor: '#34d399',
        fillOpacity: 0.15,
      }}
    >
      {clickable && label && (
        <Tooltip sticky direction="top" opacity={0.95}>
          {label}
        </Tooltip>
      )}
    </GeoJSON>
  );
}

// City marker for state alert pages — small sky-blue dot + clickable label that links to /alerts/{slug}.
// Visually distinct from red category-colored alert dots so users can see which markers lead to a city page.
function StateCityMarker({ city }) {
  const navigate = useNavigate();
  const goToCity = (e) => {
    if (e?.originalEvent) {
      e.originalEvent.preventDefault?.();
      e.originalEvent.stopPropagation?.();
    }
    navigate(`/alerts/${city.slug}`);
  };

  const labelIcon = useMemo(() => L.divIcon({
    className: 'state-city-label-wrapper',
    html: `<div class="state-city-label" style="
      display: inline-block;
      background: rgba(14, 165, 233, 0.92);
      color: white;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
      border: 1.5px solid #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      text-shadow: 0 1px 2px rgba(0,0,0,0.35);
      transform: translateX(-50%);
      cursor: pointer;
    ">${city.city}</div>`,
    iconSize: null,
    iconAnchor: [0, -10]
  }), [city.city]);

  return (
    <>
      <CircleMarker
        center={[city.lat, city.lon]}
        radius={5}
        pathOptions={{
          fillColor: '#0ea5e9',
          fillOpacity: 0.95,
          color: '#ffffff',
          weight: 2
        }}
        eventHandlers={{ click: goToCity }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95} className="enhanced-tooltip">
          <div className="px-1">
            <div className="text-xs font-semibold text-slate-800">{city.city}</div>
            <div className="text-[10px] text-sky-600">Click marker to open page</div>
          </div>
        </Tooltip>
      </CircleMarker>
      <Marker
        position={[city.lat, city.lon]}
        icon={labelIcon}
        eventHandlers={{ click: goToCity }}
      />
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

function isAlertLocationSaved(alert, userLocations) {
  if (!alert?.lat || !alert?.lon) return false;
  return userLocations.some(
    (loc) =>
      loc.name === alert.location ||
      (Math.abs(loc.lat - alert.lat) < 0.01 && Math.abs(loc.lon - alert.lon) < 0.01)
  );
}

export default function StormMap({ weatherData, stormPhase = 'pre-storm', userLocations = [], alerts = [], cityMarkers = [], isHero = false, isSidebar = false, centerOn = null, previewLocation = null, highlightedAlertId = null, selectedAlertId = null, selectedStateCode = null, highlightArea = null, onAreaClick = null, onResetView = null, showResetView = true, onAddAlertToMap = null, onRemoveAlertFromMap = null, radarLayerType = 'precipitation', radarColorScheme = 4, stateNavSource = null }) {
  const [showRadar, setShowRadar] = useState(true);
  const [radarLoading, setRadarLoading] = useState(false);
  // Delay the radar spinner so fast loads (the common case) never flash it.
  // Only surfaces if the radar genuinely takes a beat; otherwise the tiles just
  // ease in via Leaflet's fade. Kills the jarring split-second spinner.
  const [radarSpinnerVisible, setRadarSpinnerVisible] = useState(false);
  useEffect(() => {
    if (showRadar && radarLoading) {
      const t = setTimeout(() => setRadarSpinnerVisible(true), 400);
      return () => clearTimeout(t);
    }
    setRadarSpinnerVisible(false);
  }, [showRadar, radarLoading]);
  const [showAlerts, setShowAlerts] = useState(true);
  const [activeCategories, setActiveCategories] = useState(() => new Set(CATEGORY_ORDER));
  const [hoveredCatTip, setHoveredCatTip] = useState(null); // { label, x } — instant pill tooltip
  const catRowRef = useRef(null);
  const [hoveredAlert, setHoveredAlert] = useState(null);
  const [hoveredUserLocation, setHoveredUserLocation] = useState(null);
  const [hoverCardPosition, setHoverCardPosition] = useState(null);
  const [modalAlert, setModalAlert] = useState(null); // For the full alert modal
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zoomLevel, setZoomLevel] = useState(isMobile ? ZOOM_MOBILE : ZOOM_DESKTOP);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [geoTrigger, setGeoTrigger] = useState(0);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [userGeoLocation, setUserGeoLocation] = useState(null);
  const mapContainerRef = useRef(null);
  const hideAlertTimeoutRef = useRef(null);
  const pinnedAlertRef = useRef(false);
  const cities = Object.values(weatherData);

  // Count alerts per category
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const id of CATEGORY_ORDER) counts[id] = 0;
    for (const alert of alerts) {
      if (counts[alert.category] !== undefined) counts[alert.category]++;
    }
    return counts;
  }, [alerts]);

  // Top-N active Tornado Warnings get the pulsing marker treatment. Capped so
  // paint cost stays bounded during major outbreaks (real-world peak is ~30
  // simultaneous CONUS-wide; 20 covers ~99% of scenarios with graceful
  // degrade for the rest — past 20 still gets red+🌪, just no animation).
  const TORNADO_WARNING_PULSE_CAP = 20;
  const tornadoWarningPulseIds = useMemo(() => {
    const SEVERITY_RANK = { Extreme: 3, Severe: 2, Moderate: 1, Minor: 0 };
    const warnings = alerts
      .filter(a => a.category === 'tornado' && (a.event || '').includes('Warning'))
      .sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0))
      .slice(0, TORNADO_WARNING_PULSE_CAP);
    return new Set(warnings.map(a => a.id));
  }, [alerts]);

  // Smart focus: from "all shown", the first tap isolates that hazard; tapping
  // the lone focused hazard again restores all. Any other tap adds/removes
  // additively. Makes "just show me tornadoes" a single tap without losing the
  // ability to build multi-hazard combos.
  const toggleCategory = (id) => {
    setActiveCategories(prev => {
      const total = CATEGORY_ORDER.length;
      let next;
      if (prev.size === total) {
        // All shown → focus just this one.
        next = new Set([id]);
      } else if (prev.size === 1 && prev.has(id)) {
        // Only this one shown, tapped again → restore all.
        next = new Set(CATEGORY_ORDER);
      } else {
        // Refine the current subset additively.
        next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      setShowAlerts(next.size > 0);
      return next;
    });
  };

  const toggleAllCategories = () => {
    setActiveCategories(prev =>
      prev.size === CATEGORY_ORDER.length ? new Set() : new Set(CATEGORY_ORDER)
    );
  };

  // Handle alert marker hover
  const handleAlertHover = (alert, event) => {
    if (hideAlertTimeoutRef.current) {
      clearTimeout(hideAlertTimeoutRef.current);
    }
    setHoveredUserLocation(null); // Clear any hovered user location
    setHoveredAlert(alert);

    // Get position relative to map container
    if (mapContainerRef.current && event) {
      setHoverCardPosition({
        x: event.containerPoint.x,
        y: event.containerPoint.y
      });
    }
  };

  // Handle alert marker leave with delay (skipped when pinned via click/tap)
  const handleAlertLeave = () => {
    if (pinnedAlertRef.current) return;
    hideAlertTimeoutRef.current = setTimeout(() => {
      setHoveredAlert(null);
      setHoverCardPosition(null);
    }, 200);
  };

  // Handle alert marker click/tap — pins the card so it stays visible on mobile
  const handleAlertClick = (alert, event) => {
    if (hideAlertTimeoutRef.current) {
      clearTimeout(hideAlertTimeoutRef.current);
    }
    // If same alert is already pinned, dismiss it
    if (pinnedAlertRef.current && hoveredAlert?.id === alert.id) {
      pinnedAlertRef.current = false;
      setHoveredAlert(null);
      setHoverCardPosition(null);
      return;
    }
    pinnedAlertRef.current = true;
    setHoveredUserLocation(null);
    setHoveredAlert(alert);
    if (mapContainerRef.current && event) {
      setHoverCardPosition({
        x: event.containerPoint.x,
        y: event.containerPoint.y
      });
    }
  };

  // Pin alert popup while interacting with Save Location (prevents marker mouseout / map pan from dismissing)
  const pinHoveredAlert = () => {
    if (hideAlertTimeoutRef.current) {
      clearTimeout(hideAlertTimeoutRef.current);
    }
    pinnedAlertRef.current = true;
  };

  // Handle user location marker hover
  const handleUserLocationHover = (location, event) => {
    if (pinnedAlertRef.current) return;
    if (hideAlertTimeoutRef.current) {
      clearTimeout(hideAlertTimeoutRef.current);
    }
    setHoveredAlert(null); // Clear any hovered alert
    setHoveredUserLocation(location);

    // Get position relative to map container
    if (mapContainerRef.current && event) {
      setHoverCardPosition({
        x: event.containerPoint.x,
        y: event.containerPoint.y
      });
    }
  };

  // Handle user location marker leave with delay
  const handleUserLocationLeave = () => {
    hideAlertTimeoutRef.current = setTimeout(() => {
      setHoveredUserLocation(null);
      setHoverCardPosition(null);
    }, 200);
  };

  // Handle card hover (keep it visible)
  const handleCardEnter = () => {
    if (hideAlertTimeoutRef.current) {
      clearTimeout(hideAlertTimeoutRef.current);
    }
  };

  // Handle card leave
  const handleCardLeave = () => {
    pinnedAlertRef.current = false;
    setHoveredAlert(null);
    setHoveredUserLocation(null);
    setHoverCardPosition(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideAlertTimeoutRef.current) {
        clearTimeout(hideAlertTimeoutRef.current);
      }
    };
  }, []);

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
  };

  const handleResetView = () => {
    setResetTrigger(prev => prev + 1);
    trackMapReset();
    onResetView?.();
  };

  const handleMyLocation = () => {
    setGeoLoading(true);
    setGeoError(null);
    setGeoTrigger(prev => prev + 1);
  };

  const handleGeoLocated = (coords) => {
    setGeoLoading(false);
    setUserGeoLocation(coords);
    trackGeolocationUsed();
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>
            <h2 className={`font-bold truncate ${isHero ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`} style={{ color: 'antiquewhite' }}>
              Live Weather Map
            </h2>
            {stateNavSource && (
              <StateAlertsDropdown
                source={stateNavSource}
                className="hidden sm:block appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2 pr-1 py-0.5 rounded focus:outline-none text-[10px] sm:text-xs font-medium border border-sky-500/30 transition-colors flex-shrink-0"
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {stateNavSource && (
              <StateAlertsDropdown
                source={stateNavSource}
                className="sm:hidden appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2 pr-1 py-0.5 rounded focus:outline-none text-[10px] sm:text-xs font-medium border border-sky-500/30 transition-colors flex-shrink-0"
              />
            )}
            {showResetView && (
              <button
                onClick={handleResetView}
                className="px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300 cursor-pointer"
                title="Reset to default US view"
              >
                Reset View
              </button>
            )}
            {/* Radar toggle */}
            <button
              onClick={() => {
                const newState = !showRadar;
                setShowRadar(newState);
                trackRadarToggle(newState);
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

        {/* Helper text */}
        {geoError && (
          <div className="mt-3">
            <span className="text-red-400 text-[10px]">{geoError}</span>
          </div>
        )}

        {/* Alerts toggle + category filter chips */}
        {alerts.length > 0 && (
          <div ref={catRowRef} className="relative mt-2">
            {/* Instant tooltip, anchored above the specific hovered pill (rendered
                outside the scroll row so overflow-x doesn't clip it; native title
                has a ~1s OS delay). */}
            {hoveredCatTip && (
              <div
                className="absolute -top-7 -translate-x-1/2 z-[20] px-2 py-1 rounded bg-slate-900 text-slate-100 text-[10px] whitespace-nowrap shadow-lg border border-slate-700 pointer-events-none"
                style={{ left: `${hoveredCatTip.x}px` }}
              >
                {hoveredCatTip.label}
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto flex-nowrap pb-1 scrollbar-hide">
            <button
              onClick={() => {
                const allOn = activeCategories.size === CATEGORY_ORDER.length;
                const newCategories = allOn ? new Set() : new Set(CATEGORY_ORDER);
                setActiveCategories(newCategories);
                setShowAlerts(newCategories.size > 0);
                trackAlertsToggle(!allOn, alerts.length);
              }}
              className={`shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                activeCategories.size > 0
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {activeCategories.size > 0 ? '✓ Alerts' : 'Alerts'}
            </button>
            {CATEGORY_ORDER.map(id => {
              const cat = ALERT_CATEGORIES[id];
              const count = categoryCounts[id] || 0;
              if (count === 0) return null;
              const active = activeCategories.has(id);
              const color = alertCategoryColors[id] || alertCategoryColors.default;
              const allShown = activeCategories.size === CATEGORY_ORDER.length;
              const onlyThis = activeCategories.size === 1 && active;
              const title = allShown
                ? `Show only ${cat.name}`
                : onlyThis
                  ? 'Show all alerts'
                  : active
                    ? `Hide ${cat.name}`
                    : `Add ${cat.name}`;
              return (
                <button
                  key={id}
                  onClick={() => toggleCategory(id)}
                  onMouseEnter={(e) => {
                    const row = catRowRef.current;
                    if (!row) { setHoveredCatTip({ label: title, x: 0 }); return; }
                    const pill = e.currentTarget.getBoundingClientRect();
                    const wrap = row.getBoundingClientRect();
                    setHoveredCatTip({ label: title, x: pill.left - wrap.left + pill.width / 2 });
                  }}
                  onMouseLeave={() => setHoveredCatTip(null)}
                  aria-label={title}
                  className={`shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    active
                      ? ''
                      : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300'
                  }`}
                  style={active ? {
                    backgroundColor: `${color}20`,
                    color: color,
                    borderColor: `${color}66`,
                  } : undefined}
                >
                  {cat.icon} {count}
                </button>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* Map Container - fills available height in sidebar mode */}
      <div ref={mapContainerRef} className={`relative ${isSidebar ? 'flex-1 min-h-[400px]' : ''}`}>
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
          <RadarLayer show={showRadar} layerType={radarLayerType} colorScheme={radarColorScheme} onLoadingChange={setRadarLoading} />

          {/* State border highlight */}
          <StateBorderHighlight stateCode={selectedStateCode} />

          {/* "Your area" county highlight (drawn over the state outline) */}
          <FitBoundsToHighlight geojson={highlightArea} />
          <AreaHighlight geojson={highlightArea} onAreaClick={onAreaClick} />

          {/* Markers with zoom context */}
          <ZoomContext.Provider value={zoomLevel}>
            {/* Alert dot markers */}
            {alerts.filter(alert => activeCategories.has(alert.category)).map((alert) => (
              <AlertDotMarker
                key={alert.id}
                alert={alert}
                onHover={handleAlertHover}
                onLeave={handleAlertLeave}
                onClick={handleAlertClick}
                highlighted={highlightedAlertId === alert.id}
                selected={selectedAlertId === alert.id}
                shouldPulse={tornadoWarningPulseIds.has(alert.id)}
              />
            ))}

            {/* User location markers - green circles with labels */}
            {userLocations.map((location) => (
              <UserLocationMarker
                key={location.id}
                location={location}
                stormPhase={stormPhase}
                isMobile={isMobile}
                onHover={handleUserLocationHover}
                onLeave={handleUserLocationLeave}
              />
            ))}

            {/* State page city markers — clickable links to /alerts/{slug} */}
            {cityMarkers.map((city) => (
              <StateCityMarker key={city.slug} city={city} />
            ))}

            {/* Preview marker for extreme weather alerts - only show if not already a user location */}
            {previewLocation && !userLocations.some(loc =>
              loc.lat === previewLocation.lat && loc.lon === previewLocation.lon
            ) && (
              <PreviewMarker location={previewLocation} />
            )}
          </ZoomContext.Provider>
        </MapContainer>

        {/* Radar loading indicator — gentle pill while tiles fetch/paint, so
            the imagery eases in behind a spinner instead of popping into view.
            pointer-events-none keeps the map fully interactive underneath. */}
        {radarSpinnerVisible && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
            <div className="radar-loading-fade flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-sm border border-slate-700 shadow-lg">
              <span className="radar-spinner" aria-hidden="true"></span>
              <span className="text-xs font-medium text-slate-200">Loading radar…</span>
            </div>
          </div>
        )}

        {/* Gradient overlay at edges for polish */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-slate-900/30 to-transparent"></div>
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/30 to-transparent"></div>
        </div>

        {/* Alert hover card overlay */}
        {hoveredAlert && hoverCardPosition && (
          <div
            className="absolute bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-72 z-[1000]"
            style={{
              left: Math.min(Math.max(hoverCardPosition.x - 144, 8), (mapContainerRef.current?.offsetWidth || 300) - 296),
              top: Math.max(hoverCardPosition.y - 12, 8),
              transform: 'translateY(-100%)',
              pointerEvents: 'auto'
            }}
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {hoveredAlert.category === 'tornado' ? '🌪️' :
                   hoveredAlert.category === 'tropical' ? '🌀' :
                   hoveredAlert.category === 'severe' ? '⛈️' :
                   hoveredAlert.category === 'winter' ? '❄️' :
                   hoveredAlert.category === 'flood' ? '🌊' :
                   hoveredAlert.category === 'heat' ? '🌡️' :
                   hoveredAlert.category === 'fire' ? '🔥' : '⚠️'}
                </span>
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">
                    {(() => {
                      const m = (hoveredAlert.location || '').match(/^(.*?),\s*([A-Z]{2})$/);
                      if (!m) return hoveredAlert.location;
                      const abbr = m[2];
                      const slug = ABBR_TO_SLUG[abbr];
                      if (!slug) return hoveredAlert.location;
                      return (
                        <>
                          {m[1]}{', '}
                          <Link
                            to={`/alerts/${slug}`}
                            className="text-sky-600 hover:text-sky-700 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNavSource(NAV_SOURCES.HOMEPAGE_ALERT_POPUP);
                            }}
                          >
                            {abbr}
                          </Link>
                        </>
                      );
                    })()}
                  </h4>
                  <p className="text-xs text-red-600 font-medium">{hoveredAlert.event}</p>
                </div>
              </div>
              <button
                onClick={handleCardLeave}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Alert headline */}
            {hoveredAlert.headline && (
              <p className="text-xs text-slate-600 mb-2 line-clamp-3">{hoveredAlert.headline}</p>
            )}

            {/* Save, Severity & Urgency */}
            {(hoveredAlert.severity || hoveredAlert.urgency || (onAddAlertToMap && hoveredAlert.lat && hoveredAlert.lon)) && (
              <div className="flex flex-wrap items-center gap-2 mb-3 w-full">
                {onAddAlertToMap && hoveredAlert.lat && hoveredAlert.lon && (
                  <label
                    className={`group flex items-center gap-1 cursor-pointer shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                      isAlertLocationSaved(hoveredAlert, userLocations)
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      pinHoveredAlert();
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAlertLocationSaved(hoveredAlert, userLocations)}
                      onChange={(e) => {
                        e.stopPropagation();
                        pinHoveredAlert();
                        if (e.target.checked) {
                          onAddAlertToMap(hoveredAlert, SAVE_TRIGGERS.MAP_ALERT_POPUP);
                        } else if (onRemoveAlertFromMap) {
                          onRemoveAlertFromMap(hoveredAlert, SAVE_TRIGGERS.MAP_ALERT_POPUP);
                        }
                      }}
                      className={`w-3 h-3 rounded cursor-pointer focus:ring-2 focus:ring-offset-0 ${
                        isAlertLocationSaved(hoveredAlert, userLocations)
                          ? 'border-white/60 bg-white/20 accent-white focus:ring-white/50'
                          : 'border-emerald-300 bg-white accent-emerald-600 focus:ring-emerald-500'
                      }`}
                    />
                    Save
                  </label>
                )}
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 ml-auto justify-end">
                  {hoveredAlert.severity && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                      {hoveredAlert.severity}
                    </span>
                  )}
                  {hoveredAlert.urgency && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      {hoveredAlert.urgency}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* View Alert Details Button */}
            <button
              onClick={() => {
                trackAlertDetailView(hoveredAlert.event, hoveredAlert.severity, hoveredAlert.location, hoveredAlert.category);
                trackMapAlertClicked(hoveredAlert.event, hoveredAlert.location, hoveredAlert.category);
                setModalAlert(hoveredAlert);
                setHoveredAlert(null);
                setHoverCardPosition(null);
              }}
              className="block w-full text-center py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              View Alert Details →
            </button>
          </div>
        )}

        {/* User location hover card overlay */}
        {hoveredUserLocation && hoverCardPosition && (
          <div
            className="absolute bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-72 z-[1000]"
            style={{
              left: Math.min(Math.max(hoverCardPosition.x - 144, 8), (mapContainerRef.current?.offsetWidth || 300) - 296),
              top: Math.max(hoverCardPosition.y - 12, 8),
              transform: 'translateY(-100%)',
              pointerEvents: 'auto'
            }}
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getWeatherIcon(hoveredUserLocation.conditions?.shortForecast)}</span>
                <div>
                  {(() => {
                    const m = (hoveredUserLocation.name || '').match(/^(.*?),\s*([A-Z]{2})$/);
                    const linkClass = 'text-sky-600 hover:text-sky-700 hover:underline';
                    if (m) {
                      const cityPart = m[1];
                      const abbr = m[2];
                      const stateSlug = ABBR_TO_SLUG[abbr];
                      const citySlug = getCitySlugForLocation(hoveredUserLocation.name);
                      return (
                        <h4 className="font-semibold text-slate-800 text-sm">
                          {citySlug ? (
                            <Link to={`/alerts/${citySlug}`} className={linkClass} onClick={(e) => e.stopPropagation()}>
                              {cityPart}
                            </Link>
                          ) : (
                            cityPart
                          )}
                          {', '}
                          {stateSlug ? (
                            <Link
                              to={`/alerts/${stateSlug}`}
                              className={linkClass}
                              onClick={(e) => {
                                e.stopPropagation();
                                setNavSource(NAV_SOURCES.HOMEPAGE_ALERT_POPUP);
                              }}
                            >
                              {abbr}
                            </Link>
                          ) : (
                            abbr
                          )}
                        </h4>
                      );
                    }
                    const slug = getCitySlugForLocation(hoveredUserLocation.name);
                    return slug ? (
                      <Link
                        to={`/alerts/${slug}`}
                        className={`font-semibold ${linkClass} text-sm`}
                      >
                        {hoveredUserLocation.name} &rarr;
                      </Link>
                    ) : (
                      <h4 className="font-semibold text-slate-800 text-sm">{hoveredUserLocation.name}</h4>
                    );
                  })()}
                  {hoveredUserLocation.alertInfo ? (
                    <p className="text-xs text-red-600 font-medium">⚠️ {hoveredUserLocation.alertInfo.event}</p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium">✓ No active alerts</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleCardLeave}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Weather conditions with H/L */}
            <div className="text-sm text-slate-600 mb-2">
              {hoveredUserLocation.conditions?.highTemp != null || hoveredUserLocation.conditions?.lowTemp != null ? (
                <span>
                  {hoveredUserLocation.conditions.highTemp != null && <span>H: {hoveredUserLocation.conditions.highTemp}°</span>}
                  {hoveredUserLocation.conditions.highTemp != null && hoveredUserLocation.conditions.lowTemp != null && ' / '}
                  {hoveredUserLocation.conditions.lowTemp != null && <span>L: {hoveredUserLocation.conditions.lowTemp}°</span>}
                  {' · '}{hoveredUserLocation.conditions.shortForecast || 'No data'}
                </span>
              ) : hoveredUserLocation.conditions?.temperature ? (
                <span>{hoveredUserLocation.conditions.temperature}°{hoveredUserLocation.conditions.temperatureUnit || 'F'} · {hoveredUserLocation.conditions.shortForecast || 'No data'}</span>
              ) : (
                <span className="text-slate-400">Weather data loading...</span>
              )}
            </div>

            {/* Alert headline if present */}
            {hoveredUserLocation.alertInfo?.headline && (
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{hoveredUserLocation.alertInfo.headline}</p>
            )}

            {/* View Alert Details Button - only show if location has an alert */}
            {hoveredUserLocation.alertInfo && (
              <button
                onClick={() => {
                  // Track the view
                  trackAlertDetailView(
                    hoveredUserLocation.alertInfo.event,
                    hoveredUserLocation.alertInfo.severity,
                    hoveredUserLocation.name,
                    hoveredUserLocation.alertInfo.category
                  );
                  // Create an alert object from alertInfo for the modal
                  setModalAlert({
                    event: hoveredUserLocation.alertInfo.event,
                    location: hoveredUserLocation.name,
                    headline: hoveredUserLocation.alertInfo.headline,
                    category: hoveredUserLocation.alertInfo.category,
                    // These might not be available for user-added locations
                    severity: hoveredUserLocation.alertInfo.severity,
                    urgency: hoveredUserLocation.alertInfo.urgency,
                    fullDescription: hoveredUserLocation.alertInfo.fullDescription,
                    onset: hoveredUserLocation.alertInfo.onset,
                    expires: hoveredUserLocation.alertInfo.expires,
                    areaDesc: hoveredUserLocation.alertInfo.areaDesc
                  });
                  setHoveredUserLocation(null);
                  setHoverCardPosition(null);
                }}
                className="block w-full text-center py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                View Alert Details →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {modalAlert && (
        <AlertModal alert={modalAlert} onClose={() => setModalAlert(null)} />
      )}

      {/* Custom styles for pulse animation and labels */}
      <style>{`
        .pulse-marker {
          animation: pulse 2s ease-in-out infinite;
        }
        .pulse-marker-highlighted {
          animation: pulse-highlighted 0.6s ease-in-out infinite;
        }
        .pulse-marker-selected {
          animation: pulse-selected 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes pulse-highlighted {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        @keyframes pulse-selected {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        .radar-overlay-pane {
          transition: opacity 0.55s ease-in-out;
          opacity: 0;
        }
        .radar-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(148, 163, 184, 0.35);
          border-top-color: #0ea5e9;
          border-radius: 50%;
          display: inline-block;
          animation: radar-spin 0.7s linear infinite;
        }
        @keyframes radar-spin {
          to { transform: rotate(360deg); }
        }
        .radar-loading-fade {
          animation: radar-loading-in 0.25s ease-out;
        }
        @keyframes radar-loading-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .radar-spinner { animation-duration: 1.4s; }
          .radar-loading-fade { animation: none; }
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
