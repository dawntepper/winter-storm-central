/**
 * ACIS (Applied Climate Information System) Service
 * Fetches actual snow accumulation data from NOAA Regional Climate Centers
 *
 * Data sources include:
 * - Official airport weather stations (ASOS/AWOS)
 * - CoCoRaHS volunteer observers
 * - COOP network stations
 *
 * API Documentation: https://docs.rcc-acis.org/acisws/
 */

const ACIS_API_BASE = 'https://data.rcc-acis.org';

// US State FIPS codes for county lookups
const STATE_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56'
};

/**
 * Fetch station metadata near a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Search radius in miles (default 25)
 * @returns {Promise<Array>} Array of station metadata
 */
export async function findStationsNearLocation(lat, lon, radius = 25) {
  const response = await fetch(`${ACIS_API_BASE}/StnMeta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ll: `${lon},${lat}`,
      radius: radius,
      elems: ['snow', 'snwd'],
      meta: ['name', 'state', 'll', 'sids', 'elev']
    })
  });

  if (!response.ok) {
    throw new Error(`ACIS API error: ${response.status}`);
  }

  const data = await response.json();
  return data.meta || [];
}

/**
 * Fetch snow accumulation data for stations in a state
 * @param {string} stateCode - Two-letter state code (e.g., 'NY')
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Array>} Array of station data with snow observations
 */
export async function getStateSnowData(stateCode, startDate, endDate) {
  const response = await fetch(`${ACIS_API_BASE}/MultiStnData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: stateCode,
      sdate: startDate,
      edate: endDate,
      elems: [
        { name: 'snow', interval: 'dly' },  // Daily snowfall
        { name: 'snwd', interval: 'dly' }   // Snow depth
      ],
      meta: ['name', 'state', 'll', 'sids', 'elev']
    })
  });

  if (!response.ok) {
    throw new Error(`ACIS API error: ${response.status}`);
  }

  const data = await response.json();
  return parseSnowData(data.data || [], startDate, endDate);
}

/**
 * Fetch snow data for stations near a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radius - Search radius in miles
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Aggregated snow data for the location
 */
export async function getLocationSnowData(lat, lon, radius, startDate, endDate) {
  const response = await fetch(`${ACIS_API_BASE}/MultiStnData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ll: `${lon},${lat}`,
      radius: radius,
      sdate: startDate,
      edate: endDate,
      elems: [
        { name: 'snow', interval: 'dly' },
        { name: 'snwd', interval: 'dly' }
      ],
      meta: ['name', 'state', 'll', 'sids', 'elev']
    })
  });

  if (!response.ok) {
    throw new Error(`ACIS API error: ${response.status}`);
  }

  const data = await response.json();
  const stations = parseSnowData(data.data || [], startDate, endDate);

  // Find closest station with valid data
  return findBestStation(stations, lat, lon);
}

/**
 * Parse raw ACIS snow data into a usable format
 * @param {Array} rawData - Raw ACIS response data
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Array} Parsed station data
 */
function parseSnowData(rawData, startDate, endDate) {
  return rawData.map(station => {
    const { meta, data } = station;

    // Parse daily observations
    const dailyData = data.map((day, index) => {
      const [snow, snwd] = day;
      const date = addDays(startDate, index);

      return {
        date,
        snowfall: parseValue(snow),      // Daily snowfall in inches
        snowDepth: parseValue(snwd),     // Total snow depth in inches
        snowfallRaw: snow,
        snowDepthRaw: snwd
      };
    });

    // Calculate storm total
    const stormTotal = dailyData.reduce((sum, day) => {
      if (day.snowfall !== null && day.snowfall !== 'T') {
        return sum + day.snowfall;
      }
      return sum;
    }, 0);

    // Get latest snow depth
    const latestDepth = dailyData
      .filter(d => d.snowDepth !== null)
      .pop()?.snowDepth || null;

    return {
      id: meta.sids?.[0] || meta.name,
      name: meta.name,
      state: meta.state,
      lat: meta.ll?.[1],
      lon: meta.ll?.[0],
      elevation: meta.elev,
      dailyData,
      stormTotal: Math.round(stormTotal * 10) / 10,
      latestDepth,
      hasData: dailyData.some(d => d.snowfall !== null || d.snowDepth !== null),
      lastReport: findLastReportDate(dailyData)
    };
  }).filter(station => station.hasData);
}

/**
 * Parse ACIS value (handles M=missing, T=trace, A=accumulated)
 */
function parseValue(value) {
  if (value === 'M' || value === null || value === undefined) {
    return null;
  }
  if (value === 'T') {
    return 'T'; // Trace amount
  }
  // Handle accumulated values (e.g., "5A")
  const numValue = parseFloat(String(value).replace('A', ''));
  return isNaN(numValue) ? null : numValue;
}

/**
 * Add days to a date string
 */
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Find the last date with a report
 */
function findLastReportDate(dailyData) {
  for (let i = dailyData.length - 1; i >= 0; i--) {
    if (dailyData[i].snowfall !== null || dailyData[i].snowDepth !== null) {
      return dailyData[i].date;
    }
  }
  return null;
}

/**
 * Find the best station for a location (closest with valid data)
 */
function findBestStation(stations, targetLat, targetLon) {
  if (!stations.length) return null;

  // Calculate distance to each station
  const withDistance = stations.map(station => ({
    ...station,
    distance: calculateDistance(targetLat, targetLon, station.lat, station.lon)
  }));

  // Sort by distance and return closest with data
  withDistance.sort((a, b) => a.distance - b.distance);

  return {
    primary: withDistance[0],
    nearby: withDistance.slice(1, 5), // Up to 4 nearby stations
    stationCount: withDistance.length
  };
}

/**
 * Calculate distance between two points in miles (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Get storm accumulation data for multiple cities
 * @param {Array} cities - Array of city objects with lat/lon
 * @param {string} startDate - Storm start date
 * @param {string} endDate - Storm end date
 * @returns {Promise<Object>} Map of city IDs to accumulation data
 */
export async function getStormAccumulations(cities, startDate, endDate) {
  const results = {};

  // Group cities by state for efficient querying
  const byState = {};
  cities.forEach(city => {
    const state = city.state || extractState(city.name);
    if (state) {
      if (!byState[state]) byState[state] = [];
      byState[state].push(city);
    }
  });

  // Fetch data for each state
  for (const [state, stateCities] of Object.entries(byState)) {
    try {
      const stateData = await getStateSnowData(state, startDate, endDate);

      // Match stations to cities
      stateCities.forEach(city => {
        const match = findBestStation(stateData, city.lat, city.lon);
        if (match) {
          results[city.id] = {
            cityId: city.id,
            cityName: city.name,
            ...match
          };
        }
      });
    } catch (error) {
      console.error(`Error fetching ACIS data for ${state}:`, error);
    }
  }

  return results;
}

/**
 * Extract state code from city name (e.g., "Buffalo, NY" -> "NY")
 */
function extractState(cityName) {
  const match = cityName?.match(/,\s*([A-Z]{2})$/);
  return match ? match[1] : null;
}

export default {
  findStationsNearLocation,
  getStateSnowData,
  getLocationSnowData,
  getStormAccumulations
};
