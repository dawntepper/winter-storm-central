import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { STATE_GEOJSON } from '../data/stateGeoJSON';
import { STATE_NAMES } from '../data/stateConfig';

// Syncs the mini-map center/zoom to match the main map's state
function SyncView({ center, zoom }) {
  const map = useMap();
  const prevRef = useRef({ center: null, zoom: null });

  useEffect(() => {
    if (!center) return;
    const prev = prevRef.current;
    if (prev.center?.[0] === center[0] && prev.center?.[1] === center[1] && prev.zoom === zoom) return;
    prevRef.current = { center, zoom };
    map.setView(center, zoom, { animate: false });
  }, [center, zoom, map]);

  return null;
}

export default function StickyMiniMap({ mapCenterOn, selectedStateCode, mainMapId = 'storm-map-mobile' }) {
  const [visible, setVisible] = useState(false);
  const [center, setCenter] = useState([39.8, -98.5]);
  const [zoom, setZoom] = useState(4);

  // Track when main map scrolls out of view
  useEffect(() => {
    const el = document.getElementById(mainMapId);
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show mini-map only on mobile (<1024px) when main map is out of view
        setVisible(!entry.isIntersecting && window.innerWidth < 1024);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [mainMapId]);

  // Sync center/zoom from mapCenterOn
  useEffect(() => {
    if (!mapCenterOn) return;
    setCenter([mapCenterOn.lat, mapCenterOn.lon]);
    if (mapCenterOn.zoom) setZoom(mapCenterOn.zoom);
  }, [mapCenterOn]);

  const handleClick = () => {
    const el = document.getElementById(mainMapId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!visible) return null;

  const stateName = selectedStateCode ? STATE_NAMES[selectedStateCode] : null;
  const geoData = selectedStateCode ? STATE_GEOJSON[selectedStateCode] : null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] cursor-pointer"
      onClick={handleClick}
      style={{ height: '120px' }}
    >
      {/* Mini map */}
      <div className="relative w-full h-full">
        <MapContainer
          center={center}
          zoom={zoom}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          attributionControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <SyncView center={center} zoom={zoom} />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {geoData && (
            <GeoJSON
              key={selectedStateCode}
              data={geoData}
              interactive={false}
              style={{
                color: '#ffffff',
                weight: 2,
                opacity: 0.9,
                fillColor: '#ffffff',
                fillOpacity: 0.08,
              }}
            />
          )}
        </MapContainer>

        {/* Overlay label */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none">
          <span className="text-xs font-semibold text-white">
            {stateName ? `Viewing: ${stateName}` : 'Storm Map'}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            Tap to expand
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>

        {/* Top border accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500" />
      </div>
    </div>
  );
}
