import { useEffect, useState } from 'react';
import { getForecastForCoords } from '../services/forecastService';

/** @type {Map<string, object | null>} */
const cache = new Map();
/** @type {Map<string, Promise<object | null>>} */
const inflight = new Map();

function cacheKey(lat, lon) {
  return `${lat},${lon}`;
}

function fetchForecast(lat, lon) {
  const key = cacheKey(lat, lon);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const request = getForecastForCoords(lat, lon)
    .then((data) => {
      cache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch(() => {
      cache.set(key, null);
      inflight.delete(key);
      return null;
    });

  inflight.set(key, request);
  return request;
}

/**
 * Shared NWS forecast fetch for city pages. Cached per lat/lon for the SPA
 * session so Right Now + hourly/7-day sections share one request.
 */
export function useCityForecast(lat, lon) {
  const [forecast, setForecast] = useState(() => {
    const key = cacheKey(lat, lon);
    return cache.has(key) ? cache.get(key) : null;
  });
  const [loading, setLoading] = useState(() => {
    const key = cacheKey(lat, lon);
    return !cache.has(key) && Number.isFinite(lat) && Number.isFinite(lon);
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setLoading(false);
      setFailed(true);
      setForecast(null);
      return undefined;
    }

    const key = cacheKey(lat, lon);
    if (cache.has(key)) {
      setForecast(cache.get(key));
      setLoading(false);
      setFailed(cache.get(key) === null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetchForecast(lat, lon)
      .then((data) => {
        if (cancelled) return;
        setForecast(data);
        setFailed(data === null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lat, lon]);

  return { forecast, loading, failed };
}
