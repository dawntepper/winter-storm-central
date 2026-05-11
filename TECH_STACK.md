# Winter Storm Central - Technical Stack

## Overview

Winter Storm Central (StormTracking.io) is a real-time weather tracking application monitoring winter storms across the US. The app displays live snow and ice accumulation data from NOAA, radar imagery, NWS alerts, and allows users to track custom locations and subscribe to email/push alerts. It runs as a web app on Netlify and as a native iOS app via Capacitor.

## Frontend Stack

### Core Framework
- **React 19.2** - UI component library
- **React Router DOM 7.13** - Client-side routing
- **Vite 7.2** - Build tool and dev server (fast HMR, ESM-native)

### Styling
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **@tailwindcss/vite** - Vite plugin for Tailwind integration

### Mapping
- **Leaflet 1.9.4** - Interactive map library
- **react-leaflet 5.0** - React components for Leaflet
- **CARTO Dark Matter** - Dark basemap tiles (`basemaps.cartocdn.com`)
- **topojson-client** + **us-atlas** - US state geometries for heatmaps/state pages

### Code Quality
- **ESLint 9** - JavaScript linting
- **eslint-plugin-react-hooks** - React hooks rules
- **eslint-plugin-react-refresh** - Fast refresh compatibility

## Mobile (iOS)

- **Capacitor 8.1** (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`)
- **@capacitor/push-notifications 8.0** - APNs push delivery
- App ID: `com.winterstormcentral.app`
- Web assets bundled from `dist/`, iOS project in `ios/`

## Backend / Serverless (Netlify)

### Hosting & Functions
- **Netlify** - Static hosting and serverless functions
- **Netlify Functions** - Node.js (CommonJS) serverless endpoints, esbuild bundled
- **Netlify Edge Functions** - Deno-based crawler meta tag injection (`og-rewrite` on `/storm/*`, `/radar`, `/alerts/*`)
- **Scheduled Functions** - `process-weather-alerts` runs every 30 minutes (`*/30 * * * *`)
- `sharp` declared as external node module (native binary)

### Function Endpoints
- `weather-data` - NOAA forecast/observation proxy with cache
- `process-weather-alerts` - Scheduled NWS alert ingestion + notification dispatch
- `subscribe-alerts` / `unsubscribe-alerts` - Email alert subscription management
- `test-alert-email` - Manual alert email test trigger
- `og-image` - Dynamic Open Graph image generation (via `sharp`)
- `sitemap` - Dynamic sitemap.xml generation

### Caching Strategy
- Server-side in-memory cache (30-minute TTL)
- Graceful fallback to stale cache on API errors
- Client-side localStorage for user locations

## Database / Auth

- **Supabase** (`@supabase/supabase-js` 2.45)
  - Auth (email/password sign-in for alert subscriptions, admin)
  - Postgres for storm metadata, alert subscriptions, sent alert log
  - Schema: `supabase/schema.sql`
  - Migrations: `supabase/migrations/` (e.g. `001_add_sent_alerts.sql`)
- Client initialized in `src/lib/supabase.js`

## Email

- **Resend 6.9** - Transactional email (alert notifications, confirmations)
- Friendly unsubscribe route: `/unsubscribe` → `unsubscribe-alerts` function

## External APIs

### Weather Data - NOAA National Weather Service

The app uses several NOAA API endpoints (free, no API key required):

1. **Points API** - `GET https://api.weather.gov/points/{lat},{lon}`
2. **Forecast Grid Data** - `GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}` (snowfallAmount, iceAccumulation)
3. **Station Observations** - `GET https://api.weather.gov/stations/{stationId}/observations/latest`
4. **Forecast** - `GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/forecast`
5. **Active Alerts** - `GET https://api.weather.gov/alerts/active` (winter alerts feed)

**Required Headers:**
```javascript
{
  'User-Agent': 'WinterStormTracker/1.0 (contact@winterstormtracker.com)',
  'Accept': 'application/geo+json'
}
```

### ACIS (Applied Climate Information System)
- Historical/actual accumulation data via `src/services/acisService.js`

### Storm Events
- Historical storm event lookup via `src/services/stormEventsService.js`

### Geocoding - Zippopotam.us
- `GET https://api.zippopotam.us/us/{zipcode}` - free zip → city/state/lat/lon

### Radar - RainViewer
- `GET https://api.rainviewer.com/public/weather-maps.json` - tile timestamps
- Tiles: `https://tilecache.rainviewer.com/{path}/256/{z}/{x}/{y}/4/1_1.png` (color scheme 4, smooth + snow), refreshed every 5 min

## SEO

- **Static state pages** generated at build time via `scripts/generate-state-pages.js`
- **Sitemap** generated at build time (`scripts/generate-sitemap.js`) and also served dynamically via Netlify Function
- **Edge Functions** inject Open Graph meta tags for crawlers on storm/radar/alerts pages
- Internal linking + territories included in sitemap

## Analytics

- **Plausible Analytics** - Privacy-friendly, cookie-free
- Custom events: Location Added, Radar Toggled, My Locations Viewed, Alert Subscribed, etc.

## Key Files

```
winter-storm-central/
├── src/
│   ├── App.jsx                       # Main app component + router
│   ├── main.jsx                      # Entry point
│   ├── components/
│   │   ├── StormMap.jsx              # Leaflet map with markers
│   │   ├── StickyMiniMap.jsx         # Persistent compact map
│   │   ├── AccumulationsTable.jsx    # Data table with sorting
│   │   ├── ActualAccumulations.jsx   # ACIS-backed actuals
│   │   ├── ZipCodeSearch.jsx         # Location search
│   │   ├── CityCards.jsx             # City detail cards
│   │   ├── DualLeaderboard.jsx       # Snow/ice leaderboards
│   │   ├── StateHeatmap.jsx          # US state choropleth
│   │   ├── StateAlertsPage.jsx       # Per-state alerts view
│   │   ├── LiveAlertsPage.jsx        # National alerts feed
│   │   ├── LiveAlertCard.jsx         # Individual alert card
│   │   ├── LiveAlertsWidget.jsx      # Embedded alerts widget
│   │   ├── AlertSignupBar.jsx        # Email subscribe bar
│   │   ├── AlertTimeline.jsx         # Alert history timeline
│   │   ├── AuthModal.jsx             # Supabase auth UI
│   │   ├── PaywallBanner.jsx         # Subscription gate
│   │   ├── PushNotificationCard.jsx  # iOS push opt-in
│   │   ├── RadarPage.jsx             # Radar route
│   │   ├── StormEventPage.jsx        # Per-storm detail page
│   │   ├── ThreatScoreCard.jsx       # Threat score display
│   │   ├── MostImpactedStates.jsx    # Top-impacted states
│   │   ├── ExtremeWeatherSection.jsx # Extreme weather block
│   │   ├── AdminStorms.jsx           # Admin storm management
│   │   └── Header.jsx                # App header
│   ├── hooks/
│   │   ├── useWeatherData.js         # NOAA forecast/obs fetching
│   │   ├── useActualAccumulations.js # ACIS actuals
│   │   ├── useExtremeWeather.js      # Extreme weather data
│   │   ├── useLocationParam.js       # URL location param
│   │   ├── useAuth.js                # Supabase auth state
│   │   └── useSubscription.js        # Subscription/paywall state
│   ├── services/
│   │   ├── acisService.js            # ACIS historical data
│   │   ├── noaaAlertsService.js      # NWS alerts feed
│   │   └── stormEventsService.js     # Historical storm events
│   ├── lib/
│   │   └── supabase.js               # Supabase client
│   └── config/
│       └── cities.js                 # Tracked city configuration
├── netlify/
│   ├── functions/
│   │   ├── weather-data.js           # NOAA proxy + cache
│   │   ├── process-weather-alerts.js # Scheduled alert dispatch
│   │   ├── subscribe-alerts.js       # Alert subscribe
│   │   ├── unsubscribe-alerts.js     # Alert unsubscribe
│   │   ├── test-alert-email.js       # Manual test trigger
│   │   ├── og-image.js               # OG image generation
│   │   ├── sitemap.js                # Dynamic sitemap
│   │   └── lib/                      # Shared function helpers
│   └── edge-functions/
│       └── og-rewrite.js             # Crawler meta injection
├── scripts/
│   ├── generate-state-pages.js       # Build-time state HTML
│   └── generate-sitemap.js           # Build-time sitemap
├── supabase/
│   ├── schema.sql                    # Database schema
│   └── migrations/                   # SQL migrations
├── ios/                              # Capacitor iOS project
├── capacitor.config.json             # Capacitor config
├── netlify.toml                      # Netlify build/redirects/edge config
├── vite.config.mjs                   # Vite config
└── index.html                        # Entry point with SEO/meta
```

## Environment

- **Node.js** - Runtime for Netlify functions and build scripts
- **npm** - Package manager
- **.env** (gitignored) - Supabase URL/anon key, Resend API key, etc.

## Build & Deploy

Automatic deployment via Netlify on push to `main`:

1. `npm run build` runs:
   - `vite build` → static assets to `dist/`
   - `node scripts/generate-state-pages.js` → per-state HTML
   - `node scripts/generate-sitemap.js` → `dist/sitemap.xml`
2. Netlify serves static files from `dist/`
3. Functions deployed from `netlify/functions/`
4. Edge functions deployed from `netlify/edge-functions/`
5. Redirects (in order):
   - `/sitemap.xml` → `sitemap` function
   - `/api/og-image/*` → `og-image` function
   - `/unsubscribe` → `unsubscribe-alerts` function
   - `/api/*` → `/.netlify/functions/:splat`
   - `/*` → `/index.html` (SPA fallback)
6. iOS builds via Capacitor: `npm run build:app && npx cap sync ios` then build/archive in Xcode
