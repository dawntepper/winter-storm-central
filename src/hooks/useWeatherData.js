import { useState, useEffect, useCallback } from 'react';
import { cities } from '../config/cities';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const OBSERVATION_REFRESH = 5 * 60 * 1000; // 5 minutes for observations

const STORM_START = new Date('2026-01-24T00:00:00Z');
const STORM_END = new Date('2026-01-27T00:00:00Z');

// Determine if we're in the storm period
const getStormPhase = () => {
  const now = new Date();
  if (now < STORM_START) return 'pre-storm';
  if (now >= STORM_START && now < STORM_END) return 'active';
  return 'post-storm';
};

// Parse NOAA time series data to get accumulation totals
const parseAccumulation = (data, property, onlyPast = false) => {
  if (!data?.properties?.[property]?.values) {
    return 0;
  }

  const values = data.properties[property].values;
  const now = new Date();

  let total = 0;

  for (const entry of values) {
    const [timeStr] = entry.validTime.split('/');
    const entryTime = new Date(timeStr);

    // Filter to storm period
    if (entryTime >= STORM_START && entryTime < STORM_END) {
      // If onlyPast, only count data from before now (observed)
      if (onlyPast && entryTime > now) continue;

      // NOAA values are in millimeters, convert to inches
      const valueInInches = entry.value ? entry.value * 0.0393701 : 0;
      total += valueInInches;
    }
  }

  return Math.round(total * 100) / 100;
};

// Fetch latest observation from nearest station
const fetchObservation = async (lat, lon) => {
  try {
    // Get stations near the point
    const stationsUrl = `https://api.weather.gov/points/${lat},${lon}/stations`;
    const stationsResponse = await fetch(stationsUrl, {
      headers: {
        'User-Agent': 'WinterStormCentral/1.0',
        'Accept': 'application/geo+json'
      }
    });

    if (!stationsResponse.ok) return null;

    const stationsData = await stationsResponse.json();
    const stations = stationsData.features || [];

    if (stations.length === 0) return null;

    // Get observation from first (nearest) station
    const stationId = stations[0].properties.stationIdentifier;
    const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;

    const obsResponse = await fetch(obsUrl, {
      headers: {
        'User-Agent': 'WinterStormCentral/1.0',
        'Accept': 'application/geo+json'
      }
    });

    if (!obsResponse.ok) return null;

    const obsData = await obsResponse.json();
    const props = obsData.properties;

    return {
      stationId,
      stationName: stations[0].properties.name,
      timestamp: props.timestamp,
      temperature: props.temperature?.value != null
        ? Math.round(props.temperature.value * 9/5 + 32) // C to F
        : null,
      conditions: props.textDescription || 'Unknown',
      windSpeed: props.windSpeed?.value != null
        ? Math.round(props.windSpeed.value * 0.621371) // km/h to mph
        : null,
      windDirection: props.windDirection?.value,
      visibility: props.visibility?.value,
      // Precipitation in last hour (if available)
      precipLastHour: props.precipitationLastHour?.value != null
        ? Math.round(props.precipitationLastHour.value * 0.0393701 * 100) / 100
        : null
    };
  } catch (error) {
    console.error('Error fetching observation:', error);
    return null;
  }
};

// Get current weather conditions from the forecast
const parseConditions = (forecastData) => {
  if (!forecastData?.properties?.periods?.[0]) {
    return { shortForecast: 'Unknown', temperature: null };
  }

  const current = forecastData.properties.periods[0];
  return {
    shortForecast: current.shortForecast,
    temperature: current.temperature,
    temperatureUnit: current.temperatureUnit,
    windSpeed: current.windSpeed,
    icon: current.icon
  };
};

// Determine hazard type based on accumulation
const getHazardType = (snow, ice) => {
  if (ice > 0.25 && snow > 2) return 'mixed';
  if (ice > 0.1) return 'ice';
  if (snow > 0) return 'snow';
  return 'none';
};

// Fetch weather data for a single city
const fetchCityWeather = async (cityId, cityData) => {
  try {
    const pointsUrl = `https://api.weather.gov/points/${cityData.lat},${cityData.lon}`;
    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        'User-Agent': 'WinterStormCentral/1.0',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointsResponse.ok) {
      throw new Error(`Points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastGridDataUrl = pointsData.properties.forecastGridData;
    const forecastUrl = pointsData.properties.forecast;

    // Fetch grid data, forecast, and observations in parallel
    const [gridResponse, forecastResponse, observation] = await Promise.all([
      fetch(forecastGridDataUrl, {
        headers: {
          'User-Agent': 'WinterStormCentral/1.0',
          'Accept': 'application/geo+json'
        }
      }),
      fetch(forecastUrl, {
        headers: {
          'User-Agent': 'WinterStormCentral/1.0',
          'Accept': 'application/geo+json'
        }
      }),
      fetchObservation(cityData.lat, cityData.lon)
    ]);

    if (!gridResponse.ok) {
      throw new Error(`Grid API error: ${gridResponse.status}`);
    }

    const gridData = await gridResponse.json();
    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;

    // Parse forecast totals (full storm period)
    const forecastSnow = parseAccumulation(gridData, 'snowfallAmount', false);
    const forecastIce = parseAccumulation(gridData, 'iceAccumulation', false);

    // Parse observed totals (only past data points)
    const observedSnow = parseAccumulation(gridData, 'snowfallAmount', true);
    const observedIce = parseAccumulation(gridData, 'iceAccumulation', true);

    const conditions = parseConditions(forecastData);
    const hazardType = getHazardType(forecastSnow, forecastIce);
    const stormPhase = getStormPhase();

    // Determine danger level for ice
    let iceDanger = 'safe';
    if (forecastIce >= 0.5) iceDanger = 'catastrophic';
    else if (forecastIce >= 0.25) iceDanger = 'dangerous';
    else if (forecastIce > 0) iceDanger = 'caution';

    return {
      id: cityId,
      name: cityData.name,
      lat: cityData.lat,
      lon: cityData.lon,
      // Forecast totals for full storm
      forecast: {
        snowfall: forecastSnow,
        ice: forecastIce
      },
      // Observed totals so far
      observed: {
        snowfall: observedSnow,
        ice: observedIce
      },
      // Legacy fields for compatibility
      snowfall: forecastSnow,
      ice: forecastIce,
      hazardType,
      iceDanger,
      stormPhase,
      conditions,
      observation, // Real-time observation data
      lastUpdated: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    console.error(`Error fetching weather for ${cityData.name}:`, error);
    return {
      id: cityId,
      name: cityData.name,
      lat: cityData.lat,
      lon: cityData.lon,
      forecast: { snowfall: 0, ice: 0 },
      observed: { snowfall: 0, ice: 0 },
      snowfall: 0,
      ice: 0,
      hazardType: 'none',
      iceDanger: 'safe',
      stormPhase: getStormPhase(),
      conditions: { shortForecast: 'Data unavailable' },
      observation: null,
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
  }
};

export const useWeatherData = () => {
  const [weatherData, setWeatherData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [stormPhase, setStormPhase] = useState(getStormPhase());

  const fetchAllCities = useCallback(async () => {
    setLoading(true);
    setError(null);

    console.log('Fetching weather data for all cities...');

    try {
      const cityEntries = Object.entries(cities);
      const results = await Promise.all(
        cityEntries.map(([id, data]) => fetchCityWeather(id, data))
      );

      const dataMap = {};
      results.forEach(result => {
        dataMap[result.id] = result;
      });

      setWeatherData(dataMap);
      setLastRefresh(new Date());
      setStormPhase(getStormPhase());
      console.log('Weather data fetched:', dataMap);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch weather data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllCities();
  }, [fetchAllCities]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(fetchAllCities, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAllCities]);

  // Update storm phase periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setStormPhase(getStormPhase());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Get sorted arrays for leaderboards
  const getSnowLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.forecast.snowfall > 0)
      .sort((a, b) => b.forecast.snowfall - a.forecast.snowfall);
  };

  const getIceLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.forecast.ice > 0)
      .sort((a, b) => b.forecast.ice - a.forecast.ice);
  };

  // Get observed leaderboards (for during/after storm)
  const getObservedSnowLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.observed.snowfall > 0)
      .sort((a, b) => b.observed.snowfall - a.observed.snowfall);
  };

  const getObservedIceLeaderboard = () => {
    return Object.values(weatherData)
      .filter(city => city.observed.ice > 0)
      .sort((a, b) => b.observed.ice - a.observed.ice);
  };

  return {
    weatherData,
    loading,
    error,
    lastRefresh,
    stormPhase,
    refresh: fetchAllCities,
    getSnowLeaderboard,
    getIceLeaderboard,
    getObservedSnowLeaderboard,
    getObservedIceLeaderboard
  };
};
