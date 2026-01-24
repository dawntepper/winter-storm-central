export const cities = {
  dallas: { lat: 32.7767, lon: -96.7970, name: "Dallas, TX" },
  memphis: { lat: 35.1495, lon: -90.0490, name: "Memphis, TN" },
  atlanta: { lat: 33.7490, lon: -84.3880, name: "Atlanta, GA" },
  raleigh: { lat: 35.7796, lon: -78.6382, name: "Raleigh, NC" },
  stLouis: { lat: 38.6270, lon: -90.1994, name: "St. Louis, MO" },
  indianapolis: { lat: 39.7684, lon: -86.1581, name: "Indianapolis, IN" },
  cincinnati: { lat: 39.1031, lon: -84.5120, name: "Cincinnati, OH" },
  dc: { lat: 38.9072, lon: -77.0369, name: "Washington, DC" },
  baltimore: { lat: 39.2904, lon: -76.6122, name: "Baltimore, MD" },
  philly: { lat: 39.9526, lon: -75.1652, name: "Philadelphia, PA" },
  nyc: { lat: 40.7128, lon: -74.0060, name: "New York, NY" },
  boston: { lat: 42.3601, lon: -71.0589, name: "Boston, MA" }
};

export const getCitiesArray = () => {
  return Object.entries(cities).map(([id, data]) => ({
    id,
    ...data
  }));
};
