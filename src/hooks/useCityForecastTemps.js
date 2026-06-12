import { useEffect, useMemo, useState } from 'react';
import { fetchCurrentConditions } from '../utils/fetchCurrentConditions';

/** @type {Map<string, { highTemp: number, lowTemp: number, shortForecast: string } | null>} */
const cache = new Map();
/** @type {Map<string, Promise<{ highTemp: number, lowTemp: number, shortForecast: string } | null>>} */
const inflight = new Map();

function toEntry(conditions) {
  if (!conditions) return null;
  const { highTemp, lowTemp, shortForecast } = conditions;
  if (highTemp == null && lowTemp == null) return null;
  return { highTemp, lowTemp, shortForecast };
}

function fetchCityTemps(city) {
  const { slug, lat, lon } = city;
  if (!slug || typeof lat !== 'number' || typeof lon !== 'number') {
    return Promise.resolve(null);
  }

  if (cache.has(slug)) return Promise.resolve(cache.get(slug));
  if (inflight.has(slug)) return inflight.get(slug);

  const request = fetchCurrentConditions(lat, lon)
    .then((conditions) => {
      const entry = toEntry(conditions);
      cache.set(slug, entry);
      inflight.delete(slug);
      return entry;
    })
    .catch(() => {
      cache.set(slug, null);
      inflight.delete(slug);
      return null;
    });

  inflight.set(slug, request);
  return request;
}

/**
 * Lazy-load today's high/low temps for catalog cities via NWS forecast API.
 * Results are cached for the SPA session so sibling widgets on the same page
 * (Weather Forecast card + Popular Forecasts) share one fetch per city.
 *
 * @param {Array<{ slug: string, lat: number, lon: number }>} cities
 * @returns {Record<string, { highTemp?: number, lowTemp?: number, shortForecast?: string } | null | undefined>}
 */
export function useCityForecastTemps(cities) {
  const slugsKey = useMemo(
    () => cities.map((c) => c.slug).filter(Boolean).join(','),
    [cities],
  );

  const [tempsBySlug, setTempsBySlug] = useState(() => {
    const initial = {};
    for (const city of cities) {
      if (city?.slug && cache.has(city.slug)) {
        initial[city.slug] = cache.get(city.slug);
      }
    }
    return initial;
  });

  useEffect(() => {
    if (!slugsKey) return undefined;

    let cancelled = false;
    const pending = cities.filter(
      (c) => c?.slug && !cache.has(c.slug) && typeof c.lat === 'number' && typeof c.lon === 'number',
    );

    if (pending.length === 0) return undefined;

    Promise.all(pending.map((c) => fetchCityTemps(c))).then((results) => {
      if (cancelled) return;
      setTempsBySlug((prev) => {
        const next = { ...prev };
        pending.forEach((city, i) => {
          next[city.slug] = results[i];
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [slugsKey, cities]);

  return tempsBySlug;
}

export function formatHighLowTemps(highTemp, lowTemp) {
  if (highTemp == null || lowTemp == null) return null;
  return `${Math.round(highTemp)}° / ${Math.round(lowTemp)}°`;
}
