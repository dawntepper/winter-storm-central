import { useState, useEffect, useCallback } from 'react';
import { geoOrder } from '../config/cities';
import { mockWeatherData } from '../config/mockWeatherData';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const isDev = import.meta.env.DEV;

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
      // Add timestamp to bust cache on mobile browsers
      const timestamp = Date.now();
      const url = forceRefresh
        ? `/api/weather-data?refresh=true&t=${timestamp}`
        : `/api/weather-data?t=${timestamp}`;

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();

      // Handle API-level errors (e.g., stale cache returned)
      if (result.error) {
        setError(result.error);
      }

      // Use raw NOAA data directly
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

      // In development, fall back to mock data if API isn't available
      if (isDev && Object.keys(weatherData).length === 0) {
        console.log('Using mock weather data for local development');
        setWeatherData(mockWeatherData);
        setStormPhase('active'); // Show active storm UI for testing
        setLastRefresh(new Date());
        setError(null); // Clear error since we have mock data
      } else {
        setError(err.message || 'Failed to load weather data. Please try again.');

        // If we have existing data, keep it
        if (Object.keys(weatherData).length === 0) {
          setError('Weather data temporarily unavailable. Please try again in a few minutes.');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchWeatherData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchWeatherData]);

  // Refresh when tab becomes visible again (browsers throttle inactive tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if it's been more than 5 minutes since last refresh
        const fiveMinutes = 5 * 60 * 1000;
        if (!lastRefresh || (Date.now() - lastRefresh.getTime()) > fiveMinutes) {
          console.log('Tab became visible, refreshing data...');
          fetchWeatherData();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchWeatherData, lastRefresh]);

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
