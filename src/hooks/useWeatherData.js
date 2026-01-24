import { useState, useEffect, useCallback } from 'react';
import { geoOrder } from '../config/cities';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Determine if we're in the storm period
const getStormPhase = () => {
  const now = new Date();
  const STORM_START = new Date('2026-01-24T00:00:00Z');
  const STORM_END = new Date('2026-01-27T00:00:00Z');

  if (now < STORM_START) return 'pre-storm';
  if (now >= STORM_START && now < STORM_END) return 'active';
  return 'post-storm';
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

      setWeatherData(result.data || {});
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
