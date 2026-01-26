/**
 * Mock Weather Data for Local Development
 *
 * Used when the Netlify API functions aren't available (npm run dev).
 * This allows UI development without running netlify dev.
 */

// Helper to determine hazard type
const getHazardType = (snow, ice) => {
  if (ice >= 0.25 && snow >= 2) return 'mixed';
  if (ice >= 0.15) return 'ice';
  if (snow >= 1) return 'snow';
  return 'snow';
};

export const mockWeatherData = {
  dallas: {
    id: 'dallas',
    name: 'Dallas, TX',
    lat: 32.7767,
    lon: -96.7970,
    snowOrder: 1,
    iceOrder: 1,
    hazardType: 'ice',
    forecast: { snowfall: 0.5, ice: 0.35 },
    observation: { temperature: 28, conditions: 'Freezing Rain', windSpeed: 12, windDirection: 'NE' }
  },
  memphis: {
    id: 'memphis',
    name: 'Memphis, TN',
    lat: 35.1495,
    lon: -90.0490,
    snowOrder: 2,
    iceOrder: 2,
    hazardType: 'mixed',
    forecast: { snowfall: 3.2, ice: 0.15 },
    observation: { temperature: 26, conditions: 'Snow', windSpeed: 15, windDirection: 'N' }
  },
  atlanta: {
    id: 'atlanta',
    name: 'Atlanta, GA',
    lat: 33.7490,
    lon: -84.3880,
    snowOrder: null,
    iceOrder: 3,
    hazardType: 'ice',
    forecast: { snowfall: 1.5, ice: 0.28 },
    observation: { temperature: 30, conditions: 'Sleet', windSpeed: 10, windDirection: 'NE' }
  },
  raleigh: {
    id: 'raleigh',
    name: 'Raleigh, NC',
    lat: 35.7796,
    lon: -78.6382,
    snowOrder: null,
    iceOrder: 4,
    hazardType: 'mixed',
    forecast: { snowfall: 4.0, ice: 0.20 },
    observation: { temperature: 27, conditions: 'Snow', windSpeed: 18, windDirection: 'N' }
  },
  stLouis: {
    id: 'stLouis',
    name: 'St. Louis, MO',
    lat: 38.6270,
    lon: -90.1994,
    snowOrder: 3,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 6.5, ice: 0.05 },
    observation: { temperature: 22, conditions: 'Heavy Snow', windSpeed: 20, windDirection: 'NW' }
  },
  indianapolis: {
    id: 'indianapolis',
    name: 'Indianapolis, IN',
    lat: 39.7684,
    lon: -86.1581,
    snowOrder: 4,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 8.0, ice: 0.02 },
    observation: { temperature: 20, conditions: 'Heavy Snow', windSpeed: 22, windDirection: 'NW' }
  },
  cincinnati: {
    id: 'cincinnati',
    name: 'Cincinnati, OH',
    lat: 39.1031,
    lon: -84.5120,
    snowOrder: 5,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 7.5, ice: 0.08 },
    observation: { temperature: 21, conditions: 'Snow', windSpeed: 18, windDirection: 'N' }
  },
  dc: {
    id: 'dc',
    name: 'Washington, DC',
    lat: 38.9072,
    lon: -77.0369,
    snowOrder: 6,
    iceOrder: 6,
    hazardType: 'snow',
    forecast: { snowfall: 6.0, ice: 0.12 },
    observation: { temperature: 25, conditions: 'Snow', windSpeed: 15, windDirection: 'NE' }
  },
  baltimore: {
    id: 'baltimore',
    name: 'Baltimore, MD',
    lat: 39.2904,
    lon: -76.6122,
    snowOrder: 7,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 7.0, ice: 0.10 },
    observation: { temperature: 24, conditions: 'Heavy Snow', windSpeed: 16, windDirection: 'NE' }
  },
  philly: {
    id: 'philly',
    name: 'Philadelphia, PA',
    lat: 39.9526,
    lon: -75.1652,
    snowOrder: 8,
    iceOrder: 5,
    hazardType: 'snow',
    forecast: { snowfall: 8.5, ice: 0.15 },
    observation: { temperature: 23, conditions: 'Heavy Snow', windSpeed: 20, windDirection: 'NE' }
  },
  nyc: {
    id: 'nyc',
    name: 'New York, NY',
    lat: 40.7128,
    lon: -74.0060,
    snowOrder: 9,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 10.0, ice: 0.05 },
    observation: { temperature: 22, conditions: 'Heavy Snow', windSpeed: 25, windDirection: 'NE' }
  },
  boston: {
    id: 'boston',
    name: 'Boston, MA',
    lat: 42.3601,
    lon: -71.0589,
    snowOrder: 10,
    iceOrder: null,
    hazardType: 'snow',
    forecast: { snowfall: 12.0, ice: 0.02 },
    observation: { temperature: 18, conditions: 'Blizzard', windSpeed: 35, windDirection: 'NE' }
  }
};

export default mockWeatherData;
