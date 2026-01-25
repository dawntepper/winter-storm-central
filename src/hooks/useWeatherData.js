import { useState, useEffect, useCallback } from 'react';
import { geoOrder } from '../config/cities';
import { baselineForecasts } from '../config/baselineForecasts';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const MAX_ACCUMULATIONS_KEY = 'storm-fern-max-accumulations';

// Determine if we're in the storm period
const getStormPhase = () => {
  const now = new Date();
  const STORM_START = new Date('2026-01-24T00:00:00Z');
  const STORM_END = new Date('2026-01-27T00:00:00Z');

  if (now < STORM_START) return 'pre-storm';
  if (now >= STORM_START && now < STORM_END) return 'active';
  return 'post-storm';
};

// Save max accumulations to localStorage
const saveMaxAccumulations = (maxAccumulations) => {
  try {
    localStorage.setItem(MAX_ACCUMULATIONS_KEY, JSON.stringify(maxAccumulations));
  } catch (e) {
    console.error('Failed to save max accumulations:', e);
  }
};

// Get stored max accumulations from localStorage, seeding with baseline if empty
const getStoredMaxAccumulations = () => {
  try {
    const stored = localStorage.getItem(MAX_ACCUMULATIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Seed with baseline NWS forecasts if no stored data
    const seeded = {};
    Object.entries(baselineForecasts).forEach(([cityId, forecast]) => {
      seeded[cityId] = {
        snow: forecast.snowfall || 0,
        ice: forecast.ice || 0
      };
    });
    saveMaxAccumulations(seeded);
    return seeded;
  } catch {
    return {};
  }
};

// Update max accumulations - values can only go UP
const updateMaxAccumulations = (weatherData) => {
  const currentMax = getStoredMaxAccumulations();
  let updated = false;

  Object.entries(weatherData).forEach(([cityId, city]) => {
    const observedSnow = city.observed?.snowfall || 0;
    const observedIce = city.observed?.ice || 0;
    const stationSnow = city.observation?.snowDepth || 0;

    // Use station snow if available, otherwise use observed
    const newSnow = stationSnow > 0 ? stationSnow : observedSnow;
    const newIce = observedIce;

    const current = currentMax[cityId] || { snow: 0, ice: 0 };

    // Only update if new value is HIGHER
    if (newSnow > current.snow || newIce > current.ice) {
      currentMax[cityId] = {
        snow: Math.max(current.snow, newSnow),
        ice: Math.max(current.ice, newIce)
      };
      updated = true;
    }
  });

  if (updated) {
    saveMaxAccumulations(currentMax);
  }

  return currentMax;
};

// Apply max accumulations to weather data
const applyMaxAccumulations = (weatherData, maxAccumulations) => {
  const enhanced = { ...weatherData };

  Object.entries(enhanced).forEach(([cityId, city]) => {
    const max = maxAccumulations[cityId];
    if (max) {
      enhanced[cityId] = {
        ...city,
        maxAccumulation: {
          snow: max.snow,
          ice: max.ice
        }
      };
    }
  });

  return enhanced;
};

export const useWeatherData = () => {
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState(null);
  const [stormPhase, setStormPhase] = useState(getStormPhase());
  const [isCached, setIsCached] = useState(false);
  const [isStale, setIsStale] = useState(false);

  const fetchWeatherData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    console.log('Fetching weather data from Netlify function...');

    try {
      const url = forceRefresh
        ? '/api/weather-data?refresh=true'
        : '/api/weather-data';

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();

      // Handle API-level errors (e.g., stale cache returned)
      if (result.error) {
        setError(result.error);
      }

      // Update and apply max accumulations (values only go UP)
      const rawData = result.data || {};
      const maxAccumulations = updateMaxAccumulations(rawData);
      const enhancedData = applyMaxAccumulations(rawData, maxAccumulations);

      setWeatherData(enhancedData);
      setStormPhase(result.stormPhase || getStormPhase());
      setIsCached(result.cached || false);
      setIsStale(result.stale || false);
      setLastRefresh(result.lastUpdated ? new Date(result.lastUpdated) : new Date());

      if (result.lastSuccessfulUpdate) {
        setLastSuccessfulUpdate(new Date(result.lastSuccessfulUpdate));
      }

      console.log('Weather data fetched:', {
        cached: result.cached,
        stale: result.stale,
        cacheAge: result.cacheAge,
        citiesLoaded: Object.keys(result.data || {}).length
      });
    } catch (err) {
      console.error('Failed to fetch weather data:', err);
      setError(err.message || 'Failed to load weather data. Please try again.');

      // If we have existing data, keep it
      if (Object.keys(weatherData).length === 0) {
        setError('Weather data temporarily unavailable. Please try again in a few minutes.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => fetchWeatherData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchWeatherData]);

  // Update storm phase periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStormPhase(getStormPhase());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get sorted arrays for leaderboards (geographic west-to-east ordering)
  const getSnowLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.forecast?.snowfall > 0 && city.snowOrder != null)
      .sort((a, b) => a.snowOrder - b.snowOrder);
  };

  const getIceLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.forecast?.ice > 0 && city.iceOrder != null)
      .sort((a, b) => a.iceOrder - b.iceOrder);
  };

  // Get observed leaderboards (for during/after storm) - also geographic order
  const getObservedSnowLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.observed?.snowfall > 0 && city.snowOrder != null)
      .sort((a, b) => a.snowOrder - b.snowOrder);
  };

  const getObservedIceLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.observed?.ice > 0 && city.iceOrder != null)
      .sort((a, b) => a.iceOrder - b.iceOrder);
  };

  // Get cities in geographic order for cards
  const getCitiesGeoOrdered = () => {
    return geoOrder
      .map(id => weatherData[id])
      .filter(Boolean);
  };

  // Manual refresh with force flag
  const refresh = useCallback(() => {
    return fetchWeatherData(true);
  }, [fetchWeatherData]);

  return {
    weatherData,
    loading,
    error,
    lastRefresh,
    lastSuccessfulUpdate,
    stormPhase,
    isCached,
    isStale,
    refresh,
    getSnowLeaderboard,
    getIceLeaderboard,
    getObservedSnowLeaderboard,
    getObservedIceLeaderboard,
    getCitiesGeoOrdered
  };
};
