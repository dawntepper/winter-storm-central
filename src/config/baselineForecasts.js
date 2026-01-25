/**
 * Baseline NWS Forecasts for Winter Storm Fern (Jan 24-26, 2026)
 *
 * Source: IEM Archives of NWS Winter Storm Warnings issued Jan 24, 2026
 * https://mesonet.agron.iastate.edu/nws/
 *
 * These values represent the original NWS forecast predictions and can be used
 * to seed max accumulation tracking or as fallback forecast data.
 */

export const baselineForecasts = {
  // Dallas, TX - Western edge of storm, minimal impact
  dallas: {
    snowfall: 0.5,   // Light accumulation possible
    ice: 0.1,        // Light glaze
    source: 'NWS FWD estimate'
  },

  // Memphis, TN - Ice storm focus
  memphis: {
    snowfall: 1.0,   // 0.5-1.5" range
    ice: 0.35,       // Significant ice accumulation
    source: 'NWS MEG estimate'
  },

  // Atlanta, GA - Major ice storm (NWS FFC)
  atlanta: {
    snowfall: 0.5,   // Minimal snow, mostly ice
    ice: 0.5,        // "0.25-0.75 inches" - using midpoint
    source: 'NWS FFC WSW 2026-01-24'
  },

  // Raleigh, NC - Mixed precipitation (NWS RAH)
  raleigh: {
    snowfall: 2.0,   // "1-3 inches snow/sleet" - using midpoint
    ice: 0.38,       // "0.25-0.5 inch, locally 0.75" - using 0.38
    source: 'NWS RAH WSW 2026-01-24'
  },

  // St. Louis, MO - Northern snow track
  stLouis: {
    snowfall: 4.0,   // Moderate snow
    ice: 0.1,        // Light ice
    source: 'NWS LSX estimate'
  },

  // Indianapolis, IN - Snow band
  indianapolis: {
    snowfall: 5.0,   // Moderate-heavy snow
    ice: 0.1,        // Light ice
    source: 'NWS IND estimate'
  },

  // Cincinnati, OH - Mixed zone
  cincinnati: {
    snowfall: 4.0,   // Moderate snow
    ice: 0.15,       // Light ice
    source: 'NWS ILN estimate'
  },

  // Washington, DC - Heavy snow (NWS LWX)
  dc: {
    snowfall: 8.0,   // "6-10 inches, up to 12" - using 8
    ice: 0.15,       // "0.1-0.2 inch" - using midpoint
    source: 'NWS LWX WSW 2026-01-24'
  },

  // Baltimore, MD - Heavy snow (NWS LWX)
  baltimore: {
    snowfall: 8.0,   // Similar to DC, "6-10 inches"
    ice: 0.15,       // "0.1-0.2 inch"
    source: 'NWS LWX WSW 2026-01-24'
  },

  // Philadelphia, PA - Heavy snow transition zone
  philly: {
    snowfall: 6.0,   // "4-8 inches" - northern edge of heavy snow
    ice: 0.1,        // Light ice
    source: 'NWS PHI estimate based on LWX'
  },

  // New York, NY - Moderate snow
  nyc: {
    snowfall: 4.0,   // "3-5 inches" - edge of storm
    ice: 0.05,       // Minimal ice
    source: 'NWS OKX estimate'
  },

  // Boston, MA - Light snow
  boston: {
    snowfall: 2.0,   // "1-3 inches" - far edge
    ice: 0.02,       // Trace ice
    source: 'NWS BOX estimate'
  }
};

/**
 * Get baseline forecast for a city
 * @param {string} cityId - The city identifier
 * @returns {object|null} - Forecast object with snowfall and ice, or null
 */
export const getBaselineForecast = (cityId) => {
  return baselineForecasts[cityId] || null;
};

/**
 * Get all baseline forecasts as an object keyed by city ID
 * @returns {object} - All baseline forecasts
 */
export const getAllBaselineForecasts = () => {
  return baselineForecasts;
};
