# Winter Storm Tracker - Technical Stack

## Overview

Winter Storm Tracker (StormTracking.io) is a real-time weather tracking application built to monitor Winter Storm Fern affecting the Eastern US (January 24-26, 2026). The app displays live snow and ice accumulation data from NOAA, radar imagery, and allows users to track custom locations.

## Frontend Stack

### Core Framework
- **React 19.2** - UI component library
- **Vite 7.2** - Build tool and dev server (fast HMR, ESM-native)

### Styling
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **@tailwindcss/vite** - Vite plugin for Tailwind integration

### Mapping
- **Leaflet 1.9.4** - Interactive map library
- **react-leaflet 5.0** - React components for Leaflet
- **CARTO Dark Matter** - Dark basemap tiles (`basemaps.cartocdn.com`)

### Code Quality
- **ESLint 9** - JavaScript linting
- **eslint-plugin-react-hooks** - React hooks rules
- **eslint-plugin-react-refresh** - Fast refresh compatibility

## Backend / Serverless

### Hosting & Functions
- **Netlify** - Static hosting and serverless functions
- **Netlify Functions** - Node.js serverless endpoints (esbuild bundled)

### Caching Strategy
- Server-side in-memory cache (30-minute TTL)
- Graceful fallback to stale cache on API errors
- Client-side localStorage for user locations

## External APIs

### Weather Data - NOAA National Weather Service

The app uses several NOAA API endpoints (free, no API key required):

1. **Points API** - Get forecast grid for coordinates
   ```
   GET https://api.weather.gov/points/{lat},{lon}
   ```
   Returns links to forecast grid data and forecasts.

2. **Forecast Grid Data** - Detailed weather parameters
   ```
   GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}
   ```
   Provides hourly data including:
   - `snowfallAmount` - Snow accumulation (mm, converted to inches)
   - `iceAccumulation` - Ice accumulation (mm, converted to inches)

3. **Station Observations** - Real-time conditions
   ```
   GET https://api.weather.gov/stations/{stationId}/observations/latest
   ```
   Live data from weather stations (KDFW, KJFK, KBOS, etc.):
   - Temperature
   - Wind speed
   - Current conditions
   - Snow depth

4. **Forecast** - Human-readable forecasts
   ```
   GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/forecast
   ```

**Required Headers:**
```javascript
{
  'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
  'Accept': 'application/geo+json'
}
```

### Geocoding - Zippopotam.us

Free zip code lookup (no API key):
```
GET https://api.zippopotam.us/us/{zipcode}
```
Returns city name, state, latitude, and longitude.

### Radar - RainViewer

Real-time precipitation radar overlay:
```
GET https://api.rainviewer.com/public/weather-maps.json
```
Returns latest radar timestamps, then tiles are loaded from:
```
https://tilecache.rainviewer.com/{path}/256/{z}/{x}/{y}/4/1_1.png
```
- Color scheme 4 (Weather Channel style)
- Option 1_1 (smooth with snow detection)
- Refreshes every 5 minutes

## Analytics

- **Plausible Analytics** - Privacy-friendly, cookie-free analytics
- Custom events tracked:
  - Location Added (with state prop)
  - Radar Toggled
  - My Locations Viewed

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   React App     │────▶│ Netlify Function │────▶│  NOAA API   │
│  (Frontend)     │     │ /api/weather-data│     │ weather.gov │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        │               │  In-Memory Cache │
        │               │   (30 min TTL)   │
        │               └──────────────────┘
        │
        ▼
┌─────────────────┐     ┌──────────────────┐
│   localStorage  │     │   RainViewer     │
│ (User Locations)│     │   (Radar API)    │
└─────────────────┘     └──────────────────┘
```

## Key Files

```
winter-storm-tracker/
├── src/
│   ├── App.jsx                    # Main app component
│   ├── components/
│   │   ├── StormMap.jsx           # Leaflet map with markers
│   │   ├── AccumulationsTable.jsx # Data table with sorting
│   │   ├── ZipCodeSearch.jsx      # Location search (city/zip)
│   │   ├── CityCards.jsx          # City detail cards
│   │   ├── DualLeaderboard.jsx    # Snow/ice leaderboards
│   │   └── Header.jsx             # App header
│   ├── hooks/
│   │   └── useWeatherData.js      # Data fetching hook
│   └── config/
│       └── cities.js              # City configuration
├── netlify/
│   └── functions/
│       └── weather-data.js        # Serverless API endpoint
├── netlify.toml                   # Netlify configuration
└── index.html                     # Entry point with SEO/meta
```

## Tracked Cities

| City | Station ID | Snow Order | Ice Order |
|------|------------|------------|-----------|
| Dallas, TX | KDFW | 1 | 1 |
| Memphis, TN | KMEM | 2 | 2 |
| Atlanta, GA | KATL | - | 3 |
| Raleigh, NC | KRDU | - | 4 |
| St. Louis, MO | KSTL | 3 | - |
| Indianapolis, IN | KIND | 4 | - |
| Cincinnati, OH | KCVG | 5 | - |
| Washington, DC | KDCA | 6 | 6 |
| Baltimore, MD | KBWI | 7 | - |
| Philadelphia, PA | KPHL | 8 | 5 |
| New York, NY | KJFK | 9 | - |
| Boston, MA | KBOS | 10 | - |

## Environment

- **Node.js** - Runtime for Netlify functions
- **npm** - Package manager
- No environment variables required (all APIs are public)

## Deployment

Automatic deployment via Netlify on push to `main` branch:
1. `npm run build` - Vite builds to `dist/`
2. Netlify serves static files from `dist/`
3. Functions deployed from `netlify/functions/`
4. API routes redirected: `/api/*` → `/.netlify/functions/*`
