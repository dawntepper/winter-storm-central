/**
 * Hook for fetching and managing actual snow accumulation data
 * from ACIS (NOAA Regional Climate Centers)
 *
 * This is a PREMIUM feature - actual observed snowfall from
 * weather stations and CoCoRaHS volunteers.
 */

import { useState, useEffect, useCallback } from 'react';
import { getLocationSnowData, getStormAccumulations } from '../services/acisService';

// Storm Fern date range
const STORM_START = '2026-01-24';
const STORM_END = '2026-01-26';

// Refresh interval (15 minutes - data updates throughout the day)
const REFRESH_INTERVAL = 15 * 60 * 1000;

/**
 * Hook to fetch actual accumulation data for tracked cities
 * @param {Object} weatherData - Weather data from useWeatherData hook
 * @param {Array} userLocations - User's custom locations
 * @param {boolean} enabled - Whether to fetch data (for premium users)
 */
export function useActualAccumulations(weatherData, userLocations = [], enabled = false) {
  const [accumulations, setAccumulations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchAccumulations = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Combine tracked cities with user locations
      const allLocations = [
        ...Object.values(weatherData).map(city => ({
          id: city.id,
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          state: city.state
        })),
        ...userLocations.map(loc => ({
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lon: loc.lon
        }))
      ];

      if (allLocations.length === 0) {
        setAccumulations({});
        return;
      }

      // Fetch accumulation data
      const data = await getStormAccumulations(allLocations, STORM_START, STORM_END);
      setAccumulations(data);
      setLastUpdate(new Date());

      console.log('Actual accumulations fetched:', {
        citiesWithData: Object.keys(data).length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error fetching actual accumulations:', err);
      setError(err.message || 'Failed to fetch accumulation data');
    } finally {
      setLoading(false);
    }
  }, [weatherData, userLocations, enabled]);

  // Initial fetch when enabled
  useEffect(() => {
    if (enabled) {
      fetchAccumulations();
    }
  }, [enabled, fetchAccumulations]);

  // Auto-refresh
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(fetchAccumulations, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, fetchAccumulations]);

  /**
   * Get accumulation data for a specific city
   */
  const getAccumulationForCity = useCallback((cityId) => {
    return accumulations[cityId] || null;
  }, [accumulations]);

  /**
   * Get storm total snowfall for a city
   */
  const getStormTotal = useCallback((cityId) => {
    const data = accumulations[cityId];
    return data?.primary?.stormTotal || null;
  }, [accumulations]);

  /**
   * Get current snow depth for a city
   */
  const getSnowDepth = useCallback((cityId) => {
    const data = accumulations[cityId];
    return data?.primary?.latestDepth || null;
  }, [accumulations]);

  /**
   * Get formatted display data for a city
   */
  const getDisplayData = useCallback((cityId) => {
    const data = accumulations[cityId];
    if (!data?.primary) return null;

    const { primary, nearby, stationCount } = data;

    return {
      stormTotal: primary.stormTotal,
      snowDepth: primary.latestDepth,
      stationName: primary.name,
      stationDistance: primary.distance,
      lastReport: primary.lastReport,
      dailyBreakdown: primary.dailyData,
      nearbyStations: nearby?.map(s => ({
        name: s.name,
        stormTotal: s.stormTotal,
        distance: s.distance
      })),
      stationCount,
      hasTrace: primary.dailyData.some(d => d.snowfall === 'T')
    };
  }, [accumulations]);

  /**
   * Get leaderboard of highest accumulations
   */
  const getAccumulationLeaderboard = useCallback((limit = 10) => {
    return Object.values(accumulations)
      .filter(a => a.primary?.stormTotal > 0)
      .sort((a, b) => (b.primary?.stormTotal || 0) - (a.primary?.stormTotal || 0))
      .slice(0, limit)
      .map(a => ({
        cityId: a.cityId,
        cityName: a.cityName,
        stormTotal: a.primary.stormTotal,
        snowDepth: a.primary.latestDepth,
        stationName: a.primary.name,
        stationDistance: a.primary.distance
      }));
  }, [accumulations]);

  return {
    accumulations,
    loading,
    error,
    lastUpdate,
    refresh: fetchAccumulations,
    getAccumulationForCity,
    getStormTotal,
    getSnowDepth,
    getDisplayData,
    getAccumulationLeaderboard
  };
}

/**
 * Hook to fetch accumulation data for a single location
 * Useful for user-added locations
 */
export function useLocationAccumulation(lat, lon, enabled = false) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!enabled || !lat || !lon) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getLocationSnowData(lat, lon, 25, STORM_START, STORM_END);
      setData(result);
    } catch (err) {
      console.error('Error fetching location accumulation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refresh: fetch };
}

export default useActualAccumulations;
