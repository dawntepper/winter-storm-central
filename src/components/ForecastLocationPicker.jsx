import { useState } from 'react';
import { lookupZipCoords } from '../services/forecastService';
import { isValidZipFormat, INVALID_ZIP_MESSAGE } from '../services/zipLookupService';
import { getCitiesForStateSlug } from '../data/cityCatalog';

/**
 * Forecast location picker — three input modes:
 *   1. City dropdown (cities in the current state from src/content/cities/)
 *   2. ZIP code text input (any 5-digit US ZIP via Zippopotam.us)
 *   3. "Use my location" — browser geolocation
 *
 * Calls onSelect with { lat, lon, displayName, source } when the user picks.
 * Parent owns the URL state (?city= / ?zip=) and forecast fetch.
 */
export default function ForecastLocationPicker({
  stateSlug,
  stateName,
  currentLabel,
  selectedCitySlug,
  onSelect,
  onGeolocate,
}) {
  const [mode, setMode] = useState('city'); // 'city' | 'zip'
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');
  const [geoStatus, setGeoStatus] = useState('idle'); // 'idle' | 'fetching' | 'denied' | 'unsupported'
  const [zipBusy, setZipBusy] = useState(false);

  const cities = getCitiesForStateSlug(stateSlug);

  const handleCityChange = (e) => {
    const slug = e.target.value;
    if (!slug) return;
    const city = cities.find((c) => c.slug === slug);
    if (!city) return;
    onSelect({
      lat: city.lat,
      lon: city.lon,
      displayName: `${city.city}, ${city.state_abbr}`,
      source: 'city',
      citySlug: city.slug,
    });
  };

  const handleZipSubmit = async (e) => {
    e.preventDefault();
    setZipError('');
    const zip = zipInput.trim();
    if (!isValidZipFormat(zip)) {
      setZipError(INVALID_ZIP_MESSAGE);
      return;
    }
    setZipBusy(true);
    try {
      const coords = await lookupZipCoords(zip);
      onSelect({
        lat: coords.lat,
        lon: coords.lon,
        displayName: `${coords.place}, ${coords.stateAbbr} ${zip}`,
        source: 'zip',
        zip,
      });
    } catch (err) {
      setZipError(INVALID_ZIP_MESSAGE);
    } finally {
      setZipBusy(false);
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('fetching');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          if (onGeolocate) {
            await onGeolocate({ lat, lon });
          } else {
            onSelect({
              lat,
              lon,
              displayName: 'Your current location',
              source: 'geolocation',
            });
          }
        } finally {
          setGeoStatus('idle');
        }
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 sm:p-5 space-y-3 h-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-300">
          <span className="text-slate-500">Forecast for </span>
          <span className="font-semibold text-white">{currentLabel}</span>
        </div>
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={geoStatus === 'fetching'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-50 border border-sky-500/40 text-sky-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <span aria-hidden="true">📍</span>
          {geoStatus === 'fetching' ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <p className="text-xs text-amber-400">
          Location permission denied. Use the city dropdown or ZIP entry below.
        </p>
      )}
      {geoStatus === 'unsupported' && (
        <p className="text-xs text-amber-400">
          Browser geolocation unavailable. Use the city dropdown or ZIP entry below.
        </p>
      )}

      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode('city')}
          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
            mode === 'city' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          By City
        </button>
        <span className="text-slate-600">/</span>
        <button
          type="button"
          onClick={() => setMode('zip')}
          className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
            mode === 'zip' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          By ZIP
        </button>
      </div>

      {mode === 'city' && (
        <div>
          {cities.length === 0 ? (
            <p className="text-xs text-slate-500">
              No cities catalogued for {stateName} yet — use ZIP entry above for forecast for any location in this state.
            </p>
          ) : (
            <select
              value={selectedCitySlug || ''}
              onChange={handleCityChange}
              className="w-full max-w-md px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="" disabled>
                Choose a city in {stateName}…
              </option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.city}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'zip' && (
        <form onSubmit={handleZipSubmit} className="flex flex-wrap items-start gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="5-digit ZIP"
            aria-label="ZIP code"
            className="w-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={zipBusy}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {zipBusy ? 'Looking up…' : 'Get forecast'}
          </button>
          {zipError && (
            <p className="basis-full text-xs text-red-400">{zipError}</p>
          )}
        </form>
      )}

      {/* Quick-jump nearby cities for this state. Fills the picker card with
          something useful (vs. empty space when the picker's content is
          short) and encourages users to keep exploring forecasts. Pulls from
          the same cityCatalog the dropdown uses; hidden when the state has
          no catalogued cities. */}
      {cities.length > 0 && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">
            Quick jump · {stateName}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cities.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => onSelect({
                  lat: c.lat,
                  lon: c.lon,
                  displayName: `${c.city}, ${c.state_abbr}`,
                  source: 'city',
                  citySlug: c.slug,
                })}
                className="px-2.5 py-1 bg-slate-900/60 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 rounded-md text-xs text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                {c.city}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500 pt-2 leading-relaxed">
        <span aria-hidden="true">💡</span> Tip: ZIP entry works for any US
        location — handy when your city isn't in the dropdown.
      </p>
    </div>
  );
}
