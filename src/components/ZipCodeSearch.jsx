import { useState, useEffect } from 'react';

const LOCATIONS_KEY = 'winterStorm_userLocations';

// All 50 US states with major cities
const STATES_AND_CITIES = {
  'AL': {
    name: 'Alabama',
    cities: [
      { name: 'Birmingham', lat: 33.5186, lon: -86.8104 },
      { name: 'Montgomery', lat: 32.3792, lon: -86.3077 },
      { name: 'Huntsville', lat: 34.7304, lon: -86.5861 },
      { name: 'Mobile', lat: 30.6954, lon: -88.0399 },
    ]
  },
  'AK': {
    name: 'Alaska',
    cities: [
      { name: 'Anchorage', lat: 61.2181, lon: -149.9003 },
      { name: 'Fairbanks', lat: 64.8378, lon: -147.7164 },
      { name: 'Juneau', lat: 58.3019, lon: -134.4197 },
    ]
  },
  'AZ': {
    name: 'Arizona',
    cities: [
      { name: 'Phoenix', lat: 33.4484, lon: -112.0740 },
      { name: 'Tucson', lat: 32.2226, lon: -110.9747 },
      { name: 'Mesa', lat: 33.4152, lon: -111.8315 },
      { name: 'Scottsdale', lat: 33.4942, lon: -111.9261 },
    ]
  },
  'AR': {
    name: 'Arkansas',
    cities: [
      { name: 'Little Rock', lat: 34.7465, lon: -92.2896 },
      { name: 'Fort Smith', lat: 35.3859, lon: -94.3985 },
      { name: 'Fayetteville', lat: 36.0822, lon: -94.1719 },
      { name: 'Jonesboro', lat: 35.8423, lon: -90.7043 },
    ]
  },
  'CA': {
    name: 'California',
    cities: [
      { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
      { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
      { name: 'San Diego', lat: 32.7157, lon: -117.1611 },
      { name: 'Sacramento', lat: 38.5816, lon: -121.4944 },
    ]
  },
  'CO': {
    name: 'Colorado',
    cities: [
      { name: 'Denver', lat: 39.7392, lon: -104.9903 },
      { name: 'Colorado Springs', lat: 38.8339, lon: -104.8214 },
      { name: 'Boulder', lat: 40.0150, lon: -105.2705 },
      { name: 'Fort Collins', lat: 40.5853, lon: -105.0844 },
    ]
  },
  'CT': {
    name: 'Connecticut',
    cities: [
      { name: 'Hartford', lat: 41.7658, lon: -72.6734 },
      { name: 'New Haven', lat: 41.3083, lon: -72.9279 },
      { name: 'Stamford', lat: 41.0534, lon: -73.5387 },
      { name: 'Bridgeport', lat: 41.1865, lon: -73.1952 },
    ]
  },
  'DE': {
    name: 'Delaware',
    cities: [
      { name: 'Wilmington', lat: 39.7391, lon: -75.5398 },
      { name: 'Dover', lat: 39.1582, lon: -75.5244 },
      { name: 'Newark', lat: 39.6837, lon: -75.7497 },
    ]
  },
  'DC': {
    name: 'Washington DC',
    cities: [
      { name: 'Washington', lat: 38.9072, lon: -77.0369 },
    ]
  },
  'FL': {
    name: 'Florida',
    cities: [
      { name: 'Miami', lat: 25.7617, lon: -80.1918 },
      { name: 'Orlando', lat: 28.5383, lon: -81.3792 },
      { name: 'Tampa', lat: 27.9506, lon: -82.4572 },
      { name: 'Jacksonville', lat: 30.3322, lon: -81.6557 },
    ]
  },
  'GA': {
    name: 'Georgia',
    cities: [
      { name: 'Atlanta', lat: 33.7490, lon: -84.3880 },
      { name: 'Savannah', lat: 32.0809, lon: -81.0912 },
      { name: 'Augusta', lat: 33.4735, lon: -82.0105 },
      { name: 'Macon', lat: 32.8407, lon: -83.6324 },
    ]
  },
  'HI': {
    name: 'Hawaii',
    cities: [
      { name: 'Honolulu', lat: 21.3069, lon: -157.8583 },
      { name: 'Hilo', lat: 19.7074, lon: -155.0885 },
      { name: 'Kailua', lat: 21.4022, lon: -157.7394 },
    ]
  },
  'ID': {
    name: 'Idaho',
    cities: [
      { name: 'Boise', lat: 43.6150, lon: -116.2023 },
      { name: 'Idaho Falls', lat: 43.4917, lon: -112.0339 },
      { name: 'Pocatello', lat: 42.8713, lon: -112.4455 },
    ]
  },
  'IL': {
    name: 'Illinois',
    cities: [
      { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
      { name: 'Springfield', lat: 39.7817, lon: -89.6501 },
      { name: 'Peoria', lat: 40.6936, lon: -89.5890 },
      { name: 'Rockford', lat: 42.2711, lon: -89.0940 },
    ]
  },
  'IN': {
    name: 'Indiana',
    cities: [
      { name: 'Indianapolis', lat: 39.7684, lon: -86.1581 },
      { name: 'Fort Wayne', lat: 41.0793, lon: -85.1394 },
      { name: 'Evansville', lat: 37.9716, lon: -87.5711 },
      { name: 'South Bend', lat: 41.6764, lon: -86.2520 },
    ]
  },
  'IA': {
    name: 'Iowa',
    cities: [
      { name: 'Des Moines', lat: 41.5868, lon: -93.6250 },
      { name: 'Cedar Rapids', lat: 41.9779, lon: -91.6656 },
      { name: 'Davenport', lat: 41.5236, lon: -90.5776 },
      { name: 'Iowa City', lat: 41.6611, lon: -91.5302 },
    ]
  },
  'KS': {
    name: 'Kansas',
    cities: [
      { name: 'Wichita', lat: 37.6872, lon: -97.3301 },
      { name: 'Topeka', lat: 39.0489, lon: -95.6780 },
      { name: 'Kansas City', lat: 39.1141, lon: -94.6275 },
      { name: 'Overland Park', lat: 38.9822, lon: -94.6708 },
    ]
  },
  'KY': {
    name: 'Kentucky',
    cities: [
      { name: 'Louisville', lat: 38.2527, lon: -85.7585 },
      { name: 'Lexington', lat: 38.0406, lon: -84.5037 },
      { name: 'Bowling Green', lat: 36.9685, lon: -86.4808 },
      { name: 'Frankfort', lat: 38.2009, lon: -84.8733 },
    ]
  },
  'LA': {
    name: 'Louisiana',
    cities: [
      { name: 'New Orleans', lat: 29.9511, lon: -90.0715 },
      { name: 'Baton Rouge', lat: 30.4515, lon: -91.1871 },
      { name: 'Shreveport', lat: 32.5252, lon: -93.7502 },
      { name: 'Lafayette', lat: 30.2241, lon: -92.0198 },
    ]
  },
  'ME': {
    name: 'Maine',
    cities: [
      { name: 'Portland', lat: 43.6591, lon: -70.2568 },
      { name: 'Augusta', lat: 44.3106, lon: -69.7795 },
      { name: 'Bangor', lat: 44.8016, lon: -68.7712 },
    ]
  },
  'MD': {
    name: 'Maryland',
    cities: [
      { name: 'Baltimore', lat: 39.2904, lon: -76.6122 },
      { name: 'Bethesda', lat: 38.9847, lon: -77.0947 },
      { name: 'Rockville', lat: 39.0840, lon: -77.1528 },
      { name: 'Annapolis', lat: 38.9784, lon: -76.4922 },
    ]
  },
  'MA': {
    name: 'Massachusetts',
    cities: [
      { name: 'Boston', lat: 42.3601, lon: -71.0589 },
      { name: 'Worcester', lat: 42.2626, lon: -71.8023 },
      { name: 'Springfield', lat: 42.1015, lon: -72.5898 },
      { name: 'Cambridge', lat: 42.3736, lon: -71.1097 },
    ]
  },
  'MI': {
    name: 'Michigan',
    cities: [
      { name: 'Detroit', lat: 42.3314, lon: -83.0458 },
      { name: 'Grand Rapids', lat: 42.9634, lon: -85.6681 },
      { name: 'Ann Arbor', lat: 42.2808, lon: -83.7430 },
      { name: 'Lansing', lat: 42.7325, lon: -84.5555 },
    ]
  },
  'MN': {
    name: 'Minnesota',
    cities: [
      { name: 'Minneapolis', lat: 44.9778, lon: -93.2650 },
      { name: 'St. Paul', lat: 44.9537, lon: -93.0900 },
      { name: 'Duluth', lat: 46.7867, lon: -92.1005 },
      { name: 'Rochester', lat: 44.0121, lon: -92.4802 },
    ]
  },
  'MS': {
    name: 'Mississippi',
    cities: [
      { name: 'Jackson', lat: 32.2988, lon: -90.1848 },
      { name: 'Gulfport', lat: 30.3674, lon: -89.0928 },
      { name: 'Hattiesburg', lat: 31.3271, lon: -89.2903 },
      { name: 'Biloxi', lat: 30.3960, lon: -88.8853 },
    ]
  },
  'MO': {
    name: 'Missouri',
    cities: [
      { name: 'St. Louis', lat: 38.6270, lon: -90.1994 },
      { name: 'Kansas City', lat: 39.0997, lon: -94.5786 },
      { name: 'Springfield', lat: 37.2090, lon: -93.2923 },
      { name: 'Columbia', lat: 38.9517, lon: -92.3341 },
    ]
  },
  'MT': {
    name: 'Montana',
    cities: [
      { name: 'Billings', lat: 45.7833, lon: -108.5007 },
      { name: 'Missoula', lat: 46.8721, lon: -113.9940 },
      { name: 'Great Falls', lat: 47.5053, lon: -111.3008 },
      { name: 'Helena', lat: 46.5891, lon: -112.0391 },
    ]
  },
  'NE': {
    name: 'Nebraska',
    cities: [
      { name: 'Omaha', lat: 41.2565, lon: -95.9345 },
      { name: 'Lincoln', lat: 40.8258, lon: -96.6852 },
      { name: 'Grand Island', lat: 40.9264, lon: -98.3420 },
    ]
  },
  'NV': {
    name: 'Nevada',
    cities: [
      { name: 'Las Vegas', lat: 36.1699, lon: -115.1398 },
      { name: 'Reno', lat: 39.5296, lon: -119.8138 },
      { name: 'Henderson', lat: 36.0395, lon: -114.9817 },
      { name: 'Carson City', lat: 39.1638, lon: -119.7674 },
    ]
  },
  'NH': {
    name: 'New Hampshire',
    cities: [
      { name: 'Manchester', lat: 42.9956, lon: -71.4548 },
      { name: 'Concord', lat: 43.2081, lon: -71.5376 },
      { name: 'Nashua', lat: 42.7654, lon: -71.4676 },
    ]
  },
  'NJ': {
    name: 'New Jersey',
    cities: [
      { name: 'Newark', lat: 40.7357, lon: -74.1724 },
      { name: 'Jersey City', lat: 40.7178, lon: -74.0431 },
      { name: 'Trenton', lat: 40.2206, lon: -74.7597 },
      { name: 'Atlantic City', lat: 39.3643, lon: -74.4229 },
    ]
  },
  'NM': {
    name: 'New Mexico',
    cities: [
      { name: 'Albuquerque', lat: 35.0844, lon: -106.6504 },
      { name: 'Santa Fe', lat: 35.6870, lon: -105.9378 },
      { name: 'Las Cruces', lat: 32.3199, lon: -106.7637 },
    ]
  },
  'NY': {
    name: 'New York',
    cities: [
      { name: 'New York City', lat: 40.7128, lon: -74.0060 },
      { name: 'Buffalo', lat: 42.8864, lon: -78.8784 },
      { name: 'Albany', lat: 42.6526, lon: -73.7562 },
      { name: 'Syracuse', lat: 43.0481, lon: -76.1474 },
      { name: 'Rochester', lat: 43.1566, lon: -77.6088 },
    ]
  },
  'NC': {
    name: 'North Carolina',
    cities: [
      { name: 'Charlotte', lat: 35.2271, lon: -80.8431 },
      { name: 'Raleigh', lat: 35.7796, lon: -78.6382 },
      { name: 'Greensboro', lat: 36.0726, lon: -79.7920 },
      { name: 'Durham', lat: 35.9940, lon: -78.8986 },
      { name: 'Wilmington', lat: 34.2257, lon: -77.9447 },
    ]
  },
  'ND': {
    name: 'North Dakota',
    cities: [
      { name: 'Fargo', lat: 46.8772, lon: -96.7898 },
      { name: 'Bismarck', lat: 46.8083, lon: -100.7837 },
      { name: 'Grand Forks', lat: 47.9253, lon: -97.0329 },
    ]
  },
  'OH': {
    name: 'Ohio',
    cities: [
      { name: 'Columbus', lat: 39.9612, lon: -82.9988 },
      { name: 'Cleveland', lat: 41.4993, lon: -81.6944 },
      { name: 'Cincinnati', lat: 39.1031, lon: -84.5120 },
      { name: 'Toledo', lat: 41.6528, lon: -83.5379 },
    ]
  },
  'OK': {
    name: 'Oklahoma',
    cities: [
      { name: 'Oklahoma City', lat: 35.4676, lon: -97.5164 },
      { name: 'Tulsa', lat: 36.1540, lon: -95.9928 },
      { name: 'Norman', lat: 35.2226, lon: -97.4395 },
    ]
  },
  'OR': {
    name: 'Oregon',
    cities: [
      { name: 'Portland', lat: 45.5152, lon: -122.6784 },
      { name: 'Salem', lat: 44.9429, lon: -123.0351 },
      { name: 'Eugene', lat: 44.0521, lon: -123.0868 },
      { name: 'Bend', lat: 44.0582, lon: -121.3153 },
    ]
  },
  'PA': {
    name: 'Pennsylvania',
    cities: [
      { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
      { name: 'Pittsburgh', lat: 40.4406, lon: -79.9959 },
      { name: 'Harrisburg', lat: 40.2732, lon: -76.8867 },
      { name: 'Allentown', lat: 40.6084, lon: -75.4902 },
    ]
  },
  'RI': {
    name: 'Rhode Island',
    cities: [
      { name: 'Providence', lat: 41.8240, lon: -71.4128 },
      { name: 'Warwick', lat: 41.7001, lon: -71.4162 },
      { name: 'Newport', lat: 41.4901, lon: -71.3128 },
    ]
  },
  'SC': {
    name: 'South Carolina',
    cities: [
      { name: 'Columbia', lat: 34.0007, lon: -81.0348 },
      { name: 'Charleston', lat: 32.7765, lon: -79.9311 },
      { name: 'Greenville', lat: 34.8526, lon: -82.3940 },
      { name: 'Myrtle Beach', lat: 33.6891, lon: -78.8867 },
    ]
  },
  'SD': {
    name: 'South Dakota',
    cities: [
      { name: 'Sioux Falls', lat: 43.5446, lon: -96.7311 },
      { name: 'Rapid City', lat: 44.0805, lon: -103.2310 },
      { name: 'Pierre', lat: 44.3683, lon: -100.3510 },
    ]
  },
  'TN': {
    name: 'Tennessee',
    cities: [
      { name: 'Nashville', lat: 36.1627, lon: -86.7816 },
      { name: 'Memphis', lat: 35.1495, lon: -90.0490 },
      { name: 'Knoxville', lat: 35.9606, lon: -83.9207 },
      { name: 'Chattanooga', lat: 35.0456, lon: -85.3097 },
    ]
  },
  'TX': {
    name: 'Texas',
    cities: [
      { name: 'Houston', lat: 29.7604, lon: -95.3698 },
      { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
      { name: 'Austin', lat: 30.2672, lon: -97.7431 },
      { name: 'San Antonio', lat: 29.4241, lon: -98.4936 },
      { name: 'Fort Worth', lat: 32.7555, lon: -97.3308 },
    ]
  },
  'UT': {
    name: 'Utah',
    cities: [
      { name: 'Salt Lake City', lat: 40.7608, lon: -111.8910 },
      { name: 'Provo', lat: 40.2338, lon: -111.6585 },
      { name: 'Ogden', lat: 41.2230, lon: -111.9738 },
      { name: 'Park City', lat: 40.6461, lon: -111.4980 },
    ]
  },
  'VT': {
    name: 'Vermont',
    cities: [
      { name: 'Burlington', lat: 44.4759, lon: -73.2121 },
      { name: 'Montpelier', lat: 44.2601, lon: -72.5754 },
      { name: 'Rutland', lat: 43.6106, lon: -72.9726 },
    ]
  },
  'VA': {
    name: 'Virginia',
    cities: [
      { name: 'Virginia Beach', lat: 36.8529, lon: -75.9780 },
      { name: 'Richmond', lat: 37.5407, lon: -77.4360 },
      { name: 'Norfolk', lat: 36.8508, lon: -76.2859 },
      { name: 'Arlington', lat: 38.8816, lon: -77.0910 },
    ]
  },
  'WA': {
    name: 'Washington',
    cities: [
      { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
      { name: 'Spokane', lat: 47.6588, lon: -117.4260 },
      { name: 'Tacoma', lat: 47.2529, lon: -122.4443 },
      { name: 'Olympia', lat: 47.0379, lon: -122.9007 },
    ]
  },
  'WV': {
    name: 'West Virginia',
    cities: [
      { name: 'Charleston', lat: 38.3498, lon: -81.6326 },
      { name: 'Huntington', lat: 38.4192, lon: -82.4452 },
      { name: 'Morgantown', lat: 39.6295, lon: -79.9559 },
    ]
  },
  'WI': {
    name: 'Wisconsin',
    cities: [
      { name: 'Milwaukee', lat: 43.0389, lon: -87.9065 },
      { name: 'Madison', lat: 43.0731, lon: -89.4012 },
      { name: 'Green Bay', lat: 44.5133, lon: -88.0133 },
      { name: 'Eau Claire', lat: 44.8113, lon: -91.4985 },
    ]
  },
  'WY': {
    name: 'Wyoming',
    cities: [
      { name: 'Cheyenne', lat: 41.1400, lon: -104.8202 },
      { name: 'Casper', lat: 42.8666, lon: -106.3131 },
      { name: 'Jackson', lat: 43.4799, lon: -110.7624 },
    ]
  },
};

// Fetch coordinates from zip code using Zippopotam.us (free, CORS-friendly)
async function getCoordinatesFromZip(zip) {
  const url = `https://api.zippopotam.us/us/${zip}`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Zip code not found');
    }
    throw new Error('Geocoding service unavailable');
  }

  const data = await response.json();
  const place = data.places?.[0];

  if (!place) {
    throw new Error('Zip code not found');
  }

  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    name: `${place['place name']}, ${place['state abbreviation']}`,
    zip
  };
}

// Fetch weather data for coordinates (same logic as useWeatherData)
async function fetchWeatherForLocation(lat, lon, name, zip) {
  const STORM_START = new Date('2026-01-24T00:00:00Z');
  const STORM_END = new Date('2026-01-27T00:00:00Z');

  const getStormPhase = () => {
    const now = new Date();
    if (now < STORM_START) return 'pre-storm';
    if (now >= STORM_START && now < STORM_END) return 'active';
    return 'post-storm';
  };

  const parseAccumulation = (data, property, onlyPast = false) => {
    if (!data?.properties?.[property]?.values) return 0;
    const values = data.properties[property].values;
    const now = new Date();
    let total = 0;
    for (const entry of values) {
      const [timeStr] = entry.validTime.split('/');
      const entryTime = new Date(timeStr);
      if (entryTime >= STORM_START && entryTime < STORM_END) {
        if (onlyPast && entryTime > now) continue;
        const valueInInches = entry.value ? entry.value * 0.0393701 : 0;
        total += valueInInches;
      }
    }
    return Math.round(total * 100) / 100;
  };

  try {
    // Get NOAA grid point
    const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    console.log('Fetching NOAA data for:', pointsUrl);

    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        'User-Agent': 'WinterStormCentral/1.0 (contact@example.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointsResponse.ok) {
      const errorText = await pointsResponse.text();
      console.error('NOAA points API error:', pointsResponse.status, errorText);
      if (pointsResponse.status === 404) {
        throw new Error('Location outside NOAA coverage area');
      }
      throw new Error(`NOAA service error (${pointsResponse.status})`);
    }

    const pointsData = await pointsResponse.json();
    const forecastGridDataUrl = pointsData.properties.forecastGridData;
    const forecastUrl = pointsData.properties.forecast;

    // Fetch grid data and forecast
    const [gridResponse, forecastResponse] = await Promise.all([
      fetch(forecastGridDataUrl, {
        headers: { 'User-Agent': 'WinterStormCentral/1.0', 'Accept': 'application/geo+json' }
      }),
      fetch(forecastUrl, {
        headers: { 'User-Agent': 'WinterStormCentral/1.0', 'Accept': 'application/geo+json' }
      })
    ]);

    if (!gridResponse.ok) {
      throw new Error('Weather data unavailable');
    }

    const gridData = await gridResponse.json();
    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;

    // Parse accumulation data
    const forecastSnow = parseAccumulation(gridData, 'snowfallAmount', false);
    const forecastIce = parseAccumulation(gridData, 'iceAccumulation', false);
    const observedSnow = parseAccumulation(gridData, 'snowfallAmount', true);
    const observedIce = parseAccumulation(gridData, 'iceAccumulation', true);

    // Get current conditions
    const currentConditions = forecastData?.properties?.periods?.[0] || {};

    // Determine hazard type
    let hazardType = 'none';
    if (forecastIce > 0.25 && forecastSnow > 2) hazardType = 'mixed';
    else if (forecastIce > 0.1) hazardType = 'ice';
    else if (forecastSnow > 0) hazardType = 'snow';

    // Determine ice danger level
    let iceDanger = 'safe';
    if (forecastIce >= 0.5) iceDanger = 'catastrophic';
    else if (forecastIce >= 0.25) iceDanger = 'dangerous';
    else if (forecastIce > 0) iceDanger = 'caution';

    return {
      id: `user-${zip}`,
      zip,
      name,
      lat,
      lon,
      forecast: { snowfall: forecastSnow, ice: forecastIce },
      observed: { snowfall: observedSnow, ice: observedIce },
      hazardType,
      iceDanger,
      stormPhase: getStormPhase(),
      conditions: {
        shortForecast: currentConditions.shortForecast || 'Unknown',
        temperature: currentConditions.temperature,
        temperatureUnit: currentConditions.temperatureUnit
      },
      lastUpdated: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    throw error;
  }
}

// Color configs (matching CityCards)
const hazardColors = {
  snow: 'border-sky-300/30 bg-slate-800',
  ice: 'border-fuchsia-400/30 bg-slate-800',
  mixed: 'border-slate-400/30 bg-slate-800',
  none: 'border-slate-700 bg-slate-800/50'
};

const hazardLabels = {
  snow: { text: 'Snow', class: 'text-sky-300' },
  ice: { text: 'Ice', class: 'text-fuchsia-400' },
  mixed: { text: 'Mixed', class: 'text-slate-400' },
  none: { text: 'Clear', class: 'text-slate-500' }
};

const dangerBadges = {
  catastrophic: { label: 'Catastrophic', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  dangerous: { label: 'Dangerous', class: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  caution: { label: 'Caution', class: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  safe: null
};

// Weather icon helper
const getWeatherIcon = (condition) => {
  if (!condition) return '⛅';
  const c = condition.toLowerCase();
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '❄️';
  if (c.includes('cold') || c.includes('freez')) return '🥶';
  if (c.includes('thunder') || c.includes('tstorm') || c.includes('storm')) return '⛈️';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haz')) return '🌫️';
  if (c.includes('wind') || c.includes('breez')) return '💨';
  if (c.includes('cloudy') || c.includes('overcast')) {
    if (c.includes('partly') || c.includes('mostly sunny')) return '⛅';
    return '☁️';
  }
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return '☀️';
  if (c.includes('partly')) return '⛅';
  return '⛅';
};

function UserLocationCard({ data, isOnMap, onToggleMap, onRemove, onDismiss, stormPhase }) {
  return (
    <div className="rounded-xl px-4 py-3 border border-slate-700 bg-slate-800">
      {/* Compact single-line layout */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Icon + City + Alert + Weather */}
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <span className="font-semibold text-white whitespace-nowrap">
            {getWeatherIcon(data.conditions?.shortForecast)} {data.name}
          </span>
          <span className="text-slate-500">•</span>
          {data.alertInfo ? (
            <span className="text-xs text-orange-400 whitespace-nowrap">⚠️ {data.alertInfo.event}</span>
          ) : (
            <span className="text-xs text-cyan-500 whitespace-nowrap">✓ No alerts</span>
          )}
          <span className="text-slate-500">•</span>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {data.conditions?.temperature ? (
              <>{data.conditions.temperature}°{data.conditions.temperatureUnit || 'F'} · {data.conditions.shortForecast || ''}</>
            ) : (
              <>Loading...</>
            )}
          </span>
        </div>

        {/* Right: Add to Map + Close */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isOnMap}
              onChange={(e) => onToggleMap(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
            />
            <span className="text-xs text-slate-300">Map</span>
            {isOnMap && <span className="text-[10px] text-emerald-400">✓</span>}
          </label>
          <button
            onClick={isOnMap ? onDismiss : onRemove}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1"
            title={isOnMap ? "Close card" : "Remove"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ZipCodeSearch({ stormPhase, onLocationsChange }) {
  const [zip, setZip] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchMode, setSearchMode] = useState('city'); // 'city' or 'zip'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [isCardDismissed, setIsCardDismissed] = useState(false);

  // Mobile collapse state - collapsed by default on mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isExpanded, setIsExpanded] = useState(false);

  // Store all saved locations with their map visibility
  const [savedLocations, setSavedLocations] = useState({}); // { id: { data, onMap } }

  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-expand on desktop
      if (!mobile) setIsExpanded(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load saved locations on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCATIONS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedLocations(parsed);

        // Notify parent of locations that are on the map
        if (onLocationsChange) {
          const onMapLocations = Object.values(parsed)
            .filter(loc => loc.onMap)
            .map(loc => loc.data);
          onLocationsChange(onMapLocations);
        }
      } catch (e) {
        console.error('Error loading saved locations:', e);
      }
    }
  }, []);

  // Save to localStorage whenever savedLocations changes
  const updateSavedLocations = (newLocations) => {
    setSavedLocations(newLocations);
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(newLocations));

    // Notify parent of locations that are on the map
    if (onLocationsChange) {
      const onMapLocations = Object.values(newLocations)
        .filter(loc => loc.onMap)
        .map(loc => loc.data);
      onLocationsChange(onMapLocations);
    }
  };

  const fetchLocationWeather = async (zipCode) => {
    setLoading(true);
    setError(null);
    setIsCardDismissed(false);

    try {
      console.log('Looking up zip code:', zipCode);
      const coords = await getCoordinatesFromZip(zipCode);
      console.log('Got coordinates:', coords);
      const weather = await fetchWeatherForLocation(coords.lat, coords.lon, coords.name, zipCode);
      console.log('Got weather data:', weather);

      setCurrentLocationData(weather);

      // Check if this zip already exists in saved locations
      const existingLocation = savedLocations[zipCode];
      if (existingLocation) {
        // Update the data but keep the onMap setting
        const newLocations = {
          ...savedLocations,
          [zipCode]: { ...existingLocation, data: weather }
        };
        updateSavedLocations(newLocations);
      }
    } catch (err) {
      console.error('Zip code search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setCurrentLocationData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCityWeather = async (stateCode, cityData) => {
    setLoading(true);
    setError(null);
    setIsCardDismissed(false);

    const cityId = `${cityData.name}-${stateCode}`.toLowerCase().replace(/\s+/g, '-');
    const cityName = `${cityData.name}, ${stateCode}`;

    try {
      console.log('Looking up city:', cityName);
      const weather = await fetchWeatherForLocation(cityData.lat, cityData.lon, cityName, cityId);
      weather.id = `user-${cityId}`;
      console.log('Got weather data:', weather);

      setCurrentLocationData(weather);

      // Check if this city already exists in saved locations
      const existingLocation = savedLocations[cityId];
      if (existingLocation) {
        const newLocations = {
          ...savedLocations,
          [cityId]: { ...existingLocation, data: weather }
        };
        updateSavedLocations(newLocations);
      }
    } catch (err) {
      console.error('City search error:', err);
      setError(err.message || 'Failed to fetch weather data');
      setCurrentLocationData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanZip = zip.trim();

    if (!/^\d{5}$/.test(cleanZip)) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    fetchLocationWeather(cleanZip);
  };

  const handleToggleMap = (locationId, checked) => {
    const locationData = (currentLocationData?.zip === locationId || currentLocationData?.id === `user-${locationId}`)
      ? currentLocationData
      : savedLocations[locationId]?.data;

    if (!locationData) return;

    // Track location added to map
    if (checked && window.plausible) {
      // Extract state from location name (e.g., "City, ST" -> "ST")
      const state = locationData.name?.split(',').pop()?.trim() || 'Unknown';
      const totalLocations = Object.values(savedLocations).filter(l => l.onMap).length + 1;
      window.plausible('Location Added', { props: { state, count: totalLocations } });
    }

    const newLocations = {
      ...savedLocations,
      [locationId]: { data: locationData, onMap: checked }
    };

    // If unchecking and it's not the current search, remove it entirely
    const currentId = currentLocationData?.zip || currentLocationData?.id?.replace('user-', '');
    if (!checked && locationId !== currentId) {
      delete newLocations[locationId];
    }

    updateSavedLocations(newLocations);
  };

  const handleRemove = () => {
    if (!currentLocationData) return;

    const locationId = currentLocationData.zip || currentLocationData.id?.replace('user-', '');
    const newLocations = { ...savedLocations };
    delete newLocations[locationId];

    updateSavedLocations(newLocations);
    setCurrentLocationData(null);
    setZip('');
    setSelectedCity('');
  };

  const handleDismissCard = () => {
    setIsCardDismissed(true);
  };

  const handleCitySelect = () => {
    if (!selectedState || !selectedCity) return;
    const stateData = STATES_AND_CITIES[selectedState];
    const cityData = stateData?.cities.find(c => c.name === selectedCity);
    if (cityData) {
      fetchCityWeather(selectedState, cityData);
    }
  };

  const currentLocationId = currentLocationData?.zip || currentLocationData?.id?.replace('user-', '');
  const isCurrentOnMap = currentLocationData
    ? savedLocations[currentLocationId]?.onMap || false
    : false;

  const availableCities = selectedState ? STATES_AND_CITIES[selectedState]?.cities || [] : [];

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {/* Collapsible Header - always clickable */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30"
        >
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-300 cursor-pointer">
                Check Your Location
              </label>
              {/* Show count badge when collapsed */}
              {!isExpanded && Object.values(savedLocations).filter(l => l.onMap).length > 0 && (
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full">
                  {Object.values(savedLocations).filter(l => l.onMap).length} on map
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-500">Get extreme weather alerts and daily forecasts</span>
          </div>
          {/* Chevron */}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Collapsible Content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-700/50">
            <div className="flex items-center gap-3 pt-3 mb-3">
              {/* Search mode toggle */}
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSearchMode('city')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    searchMode === 'city'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  By City
                </button>
                <span className="text-slate-600">/</span>
                <button
                  type="button"
                  onClick={() => setSearchMode('zip')}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    searchMode === 'zip'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  By Zip
                </button>
              </div>
            </div>

        {searchMode === 'city' ? (
          /* City/State dropdowns */
          <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedCity('');
              }}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="">Select State</option>
              {Object.entries(STATES_AND_CITIES)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([code, state]) => (
                  <option key={code} value={code}>{state.name}</option>
                ))}
            </select>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedState}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select City</option>
              {availableCities.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCitySelect}
              disabled={loading || !selectedState || !selectedCity}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                'Check'
              )}
            </button>
          </div>
        ) : (
          /* Zip code input */
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Enter zip code"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 transition-colors"
              maxLength={5}
            />
            <button
              type="submit"
              disabled={loading || zip.length !== 5}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              ) : (
                'Search'
              )}
            </button>
          </form>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-2">{error}</p>
        )}

        {/* Device storage note */}
        <p className="text-slate-500 text-[10px] mt-2">
          Locations saved on this device only
        </p>
          </div>
        )}
      </div>

      {/* Result Card - Full Width, can be dismissed */}
      {currentLocationData && !isCardDismissed && (
        <UserLocationCard
          data={currentLocationData}
          isOnMap={isCurrentOnMap}
          onToggleMap={(checked) => handleToggleMap(currentLocationId, checked)}
          onRemove={handleRemove}
          onDismiss={handleDismissCard}
          stormPhase={stormPhase}
        />
      )}
    </div>
  );
}
