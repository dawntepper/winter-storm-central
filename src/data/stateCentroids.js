/**
 * US State Centroids (approximate center points)
 * Used as fallback when NOAA alerts don't include geometry
 * Format: FIPS state code or postal code -> { lat, lon }
 */

// State postal code to centroid
export const STATE_CENTROIDS = {
  AL: { lat: 32.806671, lon: -86.791130 },
  AK: { lat: 61.370716, lon: -152.404419 },
  AZ: { lat: 33.729759, lon: -111.431221 },
  AR: { lat: 34.969704, lon: -92.373123 },
  CA: { lat: 36.116203, lon: -119.681564 },
  CO: { lat: 39.059811, lon: -105.311104 },
  CT: { lat: 41.597782, lon: -72.755371 },
  DE: { lat: 39.318523, lon: -75.507141 },
  DC: { lat: 38.897438, lon: -77.026817 },
  FL: { lat: 27.766279, lon: -81.686783 },
  GA: { lat: 33.040619, lon: -83.643074 },
  HI: { lat: 21.094318, lon: -157.498337 },
  ID: { lat: 44.240459, lon: -114.478828 },
  IL: { lat: 40.349457, lon: -88.986137 },
  IN: { lat: 39.849426, lon: -86.258278 },
  IA: { lat: 42.011539, lon: -93.210526 },
  KS: { lat: 38.526600, lon: -96.726486 },
  KY: { lat: 37.668140, lon: -84.670067 },
  LA: { lat: 31.169546, lon: -91.867805 },
  ME: { lat: 44.693947, lon: -69.381927 },
  MD: { lat: 39.063946, lon: -76.802101 },
  MA: { lat: 42.230171, lon: -71.530106 },
  MI: { lat: 43.326618, lon: -84.536095 },
  MN: { lat: 45.694454, lon: -93.900192 },
  MS: { lat: 32.741646, lon: -89.678696 },
  MO: { lat: 38.456085, lon: -92.288368 },
  MT: { lat: 46.921925, lon: -110.454353 },
  NE: { lat: 41.125370, lon: -98.268082 },
  NV: { lat: 38.313515, lon: -117.055374 },
  NH: { lat: 43.452492, lon: -71.563896 },
  NJ: { lat: 40.298904, lon: -74.521011 },
  NM: { lat: 34.840515, lon: -106.248482 },
  NY: { lat: 42.165726, lon: -74.948051 },
  NC: { lat: 35.630066, lon: -79.806419 },
  ND: { lat: 47.528912, lon: -99.784012 },
  OH: { lat: 40.388783, lon: -82.764915 },
  OK: { lat: 35.565342, lon: -96.928917 },
  OR: { lat: 44.572021, lon: -122.070938 },
  PA: { lat: 40.590752, lon: -77.209755 },
  RI: { lat: 41.680893, lon: -71.511780 },
  SC: { lat: 33.856892, lon: -80.945007 },
  SD: { lat: 44.299782, lon: -99.438828 },
  TN: { lat: 35.747845, lon: -86.692345 },
  TX: { lat: 31.054487, lon: -97.563461 },
  UT: { lat: 40.150032, lon: -111.862434 },
  VT: { lat: 44.045876, lon: -72.710686 },
  VA: { lat: 37.769337, lon: -78.169968 },
  WA: { lat: 47.400902, lon: -121.490494 },
  WV: { lat: 38.491226, lon: -80.954453 },
  WI: { lat: 44.268543, lon: -89.616508 },
  WY: { lat: 42.755966, lon: -107.302490 },
  // Territories
  PR: { lat: 18.220833, lon: -66.590149 },
  VI: { lat: 18.335765, lon: -64.896335 },
  GU: { lat: 13.444304, lon: 144.793731 },
  AS: { lat: -14.270972, lon: -170.132217 },
  MP: { lat: 15.0979, lon: 145.6739 },
  // Federated States of Micronesia
  FM: { lat: 7.425554, lon: 150.550812 },
  // Palau
  PW: { lat: 7.51498, lon: 134.58252 }
};

// FIPS state code (2-digit) to postal code mapping
export const FIPS_TO_POSTAL = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR', '78': 'VI', '66': 'GU', '60': 'AS',
  '69': 'MP'
};

/**
 * Get coordinates from state code (postal or FIPS)
 */
export function getStateCentroid(stateCode) {
  // Try direct postal code lookup
  if (STATE_CENTROIDS[stateCode]) {
    return STATE_CENTROIDS[stateCode];
  }

  // Try FIPS to postal conversion
  const postal = FIPS_TO_POSTAL[stateCode];
  if (postal && STATE_CENTROIDS[postal]) {
    return STATE_CENTROIDS[postal];
  }

  return null;
}

/**
 * Get coordinates from SAME/FIPS code (6-digit county code)
 * Format: SSCCC where SS = state FIPS, CCC = county FIPS
 */
export function getCoordinatesFromFIPS(sameCode) {
  if (!sameCode || sameCode.length < 5) return null;

  // SAME code format varies - could be 5 or 6 digits
  // State FIPS is first 2-3 digits, we need to handle both
  let stateFips;
  if (sameCode.length === 6) {
    stateFips = sameCode.substring(0, 3).replace(/^0/, ''); // Remove leading zero
  } else {
    stateFips = sameCode.substring(0, 2);
  }

  // Pad to 2 digits for lookup
  stateFips = stateFips.padStart(2, '0');

  const postal = FIPS_TO_POSTAL[stateFips];
  if (postal && STATE_CENTROIDS[postal]) {
    return STATE_CENTROIDS[postal];
  }

  return null;
}

export default {
  STATE_CENTROIDS,
  FIPS_TO_POSTAL,
  getStateCentroid,
  getCoordinatesFromFIPS
};
