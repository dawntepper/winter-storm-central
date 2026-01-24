export const cities = {
  dallas: { lat: 32.7767, lon: -96.7970, name: "Dallas, TX", iceOrder: 1, snowOrder: 1 },
  memphis: { lat: 35.1495, lon: -90.0490, name: "Memphis, TN", iceOrder: 2, snowOrder: 2 },
  atlanta: { lat: 33.7490, lon: -84.3880, name: "Atlanta, GA", iceOrder: 3, snowOrder: null },
  raleigh: { lat: 35.7796, lon: -78.6382, name: "Raleigh, NC", iceOrder: 4, snowOrder: null },
  stLouis: { lat: 38.6270, lon: -90.1994, name: "St. Louis, MO", iceOrder: null, snowOrder: 3 },
  indianapolis: { lat: 39.7684, lon: -86.1581, name: "Indianapolis, IN", iceOrder: null, snowOrder: 4 },
  cincinnati: { lat: 39.1031, lon: -84.5120, name: "Cincinnati, OH", iceOrder: null, snowOrder: 5 },
  dc: { lat: 38.9072, lon: -77.0369, name: "Washington, DC", iceOrder: 6, snowOrder: 6 },
  baltimore: { lat: 39.2904, lon: -76.6122, name: "Baltimore, MD", iceOrder: null, snowOrder: 7 },
  philly: { lat: 39.9526, lon: -75.1652, name: "Philadelphia, PA", iceOrder: 5, snowOrder: 8 },
  nyc: { lat: 40.7128, lon: -74.0060, name: "New York, NY", iceOrder: null, snowOrder: 9 },
  boston: { lat: 42.3601, lon: -71.0589, name: "Boston, MA", iceOrder: null, snowOrder: 10 }
};

// Geographic order for city cards (west to east, following storm path)
export const geoOrder = [
  'dallas', 'memphis', 'stLouis', 'atlanta', 'indianapolis',
  'cincinnati', 'raleigh', 'dc', 'baltimore', 'philly', 'nyc', 'boston'
];

export const getCitiesArray = () => {
  return Object.entries(cities).map(([id, data]) => ({
    id,
    ...data
  }));
};

export const getCitiesInGeoOrder = () => {
  return geoOrder.map(id => ({
    id,
    ...cities[id]
  }));
};
