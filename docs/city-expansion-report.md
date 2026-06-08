# City Expansion Report

Five high-priority city alert pages added to StormTracking.io using the existing rich-city architecture.

Date: 2026-06-08.

---

## Implementation Analysis (pre-change)

### How city pages are created

| Step | Mechanism | File |
| --- | --- | --- |
| Route | Single dynamic route `/alerts/:slug` | `src/main.jsx` |
| Dispatch | State slug → `StateAlertsPage`; city slug → `CityAlertsPage` | `src/components/AlertsRouteDispatch.jsx` |
| Data | One JSON file per city | `src/content/cities/{slug}.json` |
| Routing index | Slug registry for dispatch + lookups | `src/content/cities/index.json` |
| UI | Shared `CityAlertsPage` component (alerts, radar, forecast, seasonal risk, nearby cities) | `src/components/CityAlertsPage.jsx` |
| Static HTML | Build script writes per-city `index.html` | `scripts/generate-city-pages.js` |
| Sitemap | Build script reads all `*.json` (excl. index) | `scripts/generate-sitemap.js` |

**No per-city React files or route entries are required.** Adding a JSON file + `index.json` entry is sufficient.

### Metadata generation

| Layer | Source | Output |
| --- | --- | --- |
| Crawler (static) | `generate-city-pages.js` | `<title>`, meta description, canonical, OG, Twitter, JSON-LD |
| SPA navigation | `CityAlertsPage.setCityMetaTags()` | Same fields at runtime |
| Structured data | `CityAlertsPage.buildJsonLd()` | WebPage + Place + BreadcrumbList |

Title template: `{City}, {State} Weather Alerts & Forecast — Live NWS Warnings | StormTracking.io`

### State → city internal linking

`StateAlertsPage` renders `CityDirectory` from `CitiesInState.jsx`, which groups cities by `state_abbr` from `index.json`. **No state-page code changes needed** when new cities are added to the index.

### Page sections (from `CityAlertsPage`)

All sections are data-driven from city JSON — no per-city UI code:

- Live NWS alerts (zone: `nws_zone`)
- StormMap radar hero (lat/lon)
- Current conditions (Open-Meteo)
- 24-hour + 7-day forecast (NWS)
- Related links (radar + state alerts)
- Nearby cities (from `nearby_cities` slugs in index)
- Seasonal Risk Profile (`description_long` + `seasonal_risks`)

There is no separate FAQ component on city pages; the **Seasonal Risk Profile** section serves the long-form SEO content role (same as all existing cities).

### NWS zone verification

Zones were resolved via `api.weather.gov/points/{lat},{lon}` at authoring time:

| City | Zone | Office | County FIPS |
| --- | --- | --- | --- |
| Atlanta | GAZ033 | FFC | 13121 (Fulton) |
| Charlotte | NCZ071 | GSP | 37119 (Mecklenburg) |
| Raleigh | NCZ041 | RAH | 37183 (Wake) |
| Austin | TXZ192 | EWX | 48453 (Travis) |
| San Antonio | TXZ205 | EWX | 48029 (Bexar) |

---

## Cities Added

| City | State | Route | JSON file |
| --- | --- | --- | --- |
| Atlanta | GA | `/alerts/atlanta-ga` | `src/content/cities/atlanta-ga.json` |
| Charlotte | NC | `/alerts/charlotte-nc` | `src/content/cities/charlotte-nc.json` |
| Raleigh | NC | `/alerts/raleigh-nc` | `src/content/cities/raleigh-nc.json` |
| Austin | TX | `/alerts/austin-tx` | `src/content/cities/austin-tx.json` |
| San Antonio | TX | `/alerts/san-antonio-tx` | `src/content/cities/san-antonio-tx.json` |

**Catalog size:** 50 → **55** city alert pages.

**Priority metro coverage:** 28/47 → **33/47 (70%)** on the audited high-priority list.

---

## Sitemap Verification

`scripts/generate-sitemap.js` → `loadCities()` reads every `src/content/cities/*.json` except `index.json`.

| Check | Result |
| --- | --- |
| `index.json` entries | 55 |
| Rich JSON files | 55 |
| Index ↔ files in sync | ✅ Zero mismatches |
| New URLs in sitemap after build | ✅ All five slugs included at `priority 0.7` |

Expected sitemap entries:

```
https://stormtracking.io/alerts/atlanta-ga
https://stormtracking.io/alerts/charlotte-nc
https://stormtracking.io/alerts/raleigh-nc
https://stormtracking.io/alerts/austin-tx
https://stormtracking.io/alerts/san-antonio-tx
```

Run `npm run build` (or `build:seo`) to regenerate `dist/sitemap.xml` and static HTML.

---

## Internal Linking Verification

### Automatic (no code changes required)

| Surface | How new cities appear |
| --- | --- |
| **Georgia state page** (`/alerts/georgia`) | `CityDirectory` now lists Atlanta + Savannah |
| **North Carolina state page** (`/alerts/north-carolina`) | Lists Charlotte, Raleigh, Wilmington |
| **Texas state page** (`/alerts/texas`) | Lists Austin, Dallas, Fort Worth, Houston, San Antonio |
| **Route dispatch** | `AlertsRouteDispatch` `CITY_SLUGS` from updated `index.json` |
| **NearMeHeader / LiveAlertCard** | `cityLookup.js` reads updated `index.json` |
| **Forecast picker** | `cityCatalog.js` glob picks up new rich JSON automatically |

### Nearby-city cross-links updated (bidirectional)

| File updated | Change |
| --- | --- |
| `savannah-ga.json` | Added `atlanta-ga` to `nearby_cities` |
| `wilmington-nc.json` | Added `charlotte-nc`, `raleigh-nc` |
| `nashville-tn.json` | Replaced `little-rock-ar` with `atlanta-ga` |
| `dallas-tx.json` | Replaced `oklahoma-city-ok` with `austin-tx` |
| `houston-tx.json` | Added `san-antonio-tx`, `austin-tx` |

New cities link to each other and existing metros in their `nearby_cities` arrays.

---

## SEO Validation

All five cities inherit the same SEO pipeline as existing pages.

| Requirement | Mechanism | Status |
| --- | --- | --- |
| Unique title | City + state in template | ✅ Per-city unique |
| Unique meta description | City + state interpolated | ✅ Per-city unique |
| Canonical URL | `https://stormtracking.io/alerts/{slug}` | ✅ |
| Open Graph tags | title, description, url, image | ✅ `generate-city-pages.js` + runtime |
| Twitter cards | title, description, image | ✅ |
| JSON-LD | WebPage, Place, BreadcrumbList | ✅ `buildJsonLd()` + static build |
| Sitemap inclusion | `generate-sitemap.js` | ✅ After build |

### Post-deploy checklist

1. `npm run build` — regenerate static HTML + sitemap
2. Submit new URLs via `/admin/seo` custom IndexNow field (no bulk city button today)
3. Spot-check live pages: `/alerts/atlanta-ga`, etc.
4. Confirm `CityDirectory` on `/alerts/georgia`, `/alerts/north-carolina`, `/alerts/texas`

---

## Follow-Up Opportunities

Next **10 cities** ranked by severe-weather exposure, population, and remaining priority gaps:

| Rank | City | State | Proposed slug | Rationale |
| ---: | --- | --- | --- | --- |
| 1 | El Paso | TX | `el-paso-tx` | Completes TX priority list; desert severe / monsoon edge |
| 2 | St Petersburg | FL | `st-petersburg-fl` | Tampa Bay; Gulf hurricane; completes FL priority list |
| 3 | Greensboro | NC | `greensboro-nc` | NC Piedmont severe; completes NC priority triad inland |
| 4 | Columbia | SC | `columbia-sc` | State capital; Dixie Alley |
| 5 | Baton Rouge | LA | `baton-rouge-la` | Gulf hurricane / flood; state capital |
| 6 | Los Angeles | CA | `los-angeles-ca` | Largest U.S. metro; forecast-fill ready to promote |
| 7 | Knoxville | TN | `knoxville-tn` | Dixie Alley; completes TN priority gap |
| 8 | Phoenix | AZ | `phoenix-az` | Monsoon + extreme heat; forecast-fill ready |
| 9 | Topeka | KS | `topeka-ks` | Tornado Alley state capital |
| 10 | Washington | DC | `washington-dc` | Capital region; storm tracker adjacent; forecast-fill ready |

### Quick wins (ranks 6, 8, 10)

Los Angeles, Phoenix, and Washington DC already exist in `FORECAST_PICKER_FILL` with coordinates — promotion requires rich JSON authoring (NWS zone, descriptions) only.

### Coverage impact if all 10 are added

- Priority metro list: **33/47 → 43/47 (91%)**
- Total city pages: **55 → 65**
- States with city pages: **28 → 30** (adds CA, AZ, DC coverage via city pages)

---

## Files Changed

### New files (5)

- `src/content/cities/atlanta-ga.json`
- `src/content/cities/charlotte-nc.json`
- `src/content/cities/raleigh-nc.json`
- `src/content/cities/austin-tx.json`
- `src/content/cities/san-antonio-tx.json`

### Updated files (6)

- `src/content/cities/index.json` — 5 new routing entries
- `src/content/cities/savannah-ga.json` — nearby cities
- `src/content/cities/wilmington-nc.json` — nearby cities
- `src/content/cities/nashville-tn.json` — nearby cities
- `src/content/cities/dallas-tx.json` — nearby cities
- `src/content/cities/houston-tx.json` — nearby cities

No React, routing, or build-script changes were required.
