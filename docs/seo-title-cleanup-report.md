# SEO Title & Meta Description Cleanup Report

StormTracking.io — June 2026

## Summary

Updated `<title>`, meta descriptions, Open Graph, and Twitter tags across state, city, homepage, and radar page types. Static HTML generators and SPA runtime meta setters now use identical strings per page type.

---

## 1. State Pages (`/alerts/{state-slug}`)

| | Old | New | Chars |
|---|-----|-----|-------|
| **Title (static)** | `{State} Weather Alerts — Live Severe Weather Warnings \| StormTracking` | `{State} Weather Alerts Today — Live NWS Warnings & Radar` | 67 → 54* |
| **Title (SPA, was drifted)** | `{State} Weather Alerts \| Live NWS Alerts \| StormTracking` | *(same as static)* | ~58 → 54* |
| **Meta** | `Live {State} severe weather alerts from the National Weather Service. Real-time warnings, watches, and advisories for storms, hurricanes, tornadoes, flooding, and winter weather. Updated every 30 minutes.` | `Active NWS warnings across {State} right now. Live radar, tornado and severe thunderstorm watches, flood and winter alerts — updated continuously.` | 202 → 144* |

\*Example using Texas. OG/Twitter title and description now match page title and meta exactly.

**Canonical:** unchanged (`https://stormtracking.io/alerts/{slug}`)

---

## 2. City Pages (`/alerts/{city-slug}`)

| | Old | New | Chars |
|---|-----|-----|-------|
| **Title** | `{City}, {State full name} Weather Alerts & Forecast — Live NWS Warnings \| StormTracking.io` | `{City}, {ST} Weather Alerts — Live Warnings & Radar` | 79 → 50* |
| **Meta** | `Live weather alerts and current conditions for {City}, {State}. Real-time National Weather Service warnings, watches, and current temperature. Updated continuously, no ads.` | `Is {City} under a weather warning right now? Live NWS alerts, current conditions, and radar for {City}, {ST} — updated every few minutes.` | 171 → 137* |

\*Example using Houston, TX (`state_abbr` used for ST).

**Canonical:** unchanged. JSON-LD `WebPage.name` and `WebPage.description` updated to match new patterns.

---

## 3. Homepage (`/`)

| | Old | New | Chars |
|---|-----|-----|-------|
| **Title** | `Weather Near Me - Live Radar & Real-Time Storm Alerts \| StormTracking` | `Live Weather Radar Near You — NWS Alerts & Storm Map` | 69 → 52 |
| **Meta** | `Track severe weather near me with live radar maps and real-time NWS alerts. Find storms, winter weather, hurricanes, and active warnings for your local area instantly. Free NOAA/NWS data.` | `See active NWS warnings on a live radar map for your area. Tornado, flood, winter storm, and hurricane alerts — free and updated in real time.` | 187 → 142 |
| **OG title** | `StormTracking - Live Weather Radar & Real-Time Alerts` | `Live Weather Radar Near You — NWS Alerts & Storm Map` | — |
| **Twitter title** | `StormTracking - Live Weather Radar & Storm Alerts` | `Live Weather Radar Near You — NWS Alerts & Storm Map` | — |

**Canonical:** unchanged (`https://stormtracking.io`). `homepageMeta.js` and `index.html` kept in sync.

---

## 4. Radar Page (`/radar`)

| | Old | New | Chars |
|---|-----|-----|-------|
| **Title (SPA)** | `Live Weather Radar Map \| Real-Time Storm Tracking \| StormTracking` | `NWS Live Radar Map — NOAA Precipitation & Storms` | 65 → 48 |
| **Title (static)** | `Live Weather Radar Map — Real-Time NOAA/NWS Radar \| StormTracking` | `NWS Live Radar Map — NOAA Precipitation & Storms` | — → 48 |
| **Meta** | `Interactive live weather radar map for the United States. Track severe weather, storms, and precipitation in real-time with radar overlay. Free NOAA/NWS radar data.` | `Interactive US weather radar with precipitation, satellite, and forecast layers. Track storms in real time with NWS alert overlays.` | 164 → 131 |

**Canonical:** unchanged (`https://stormtracking.io/radar`). Static pre-render in `generate-static-pages.js` updated to match SPA.

---

## Files Modified

| File | Change |
|------|--------|
| `scripts/generate-state-pages.js` | Title, meta, OG, Twitter, JSON-LD |
| `src/components/StateAlertsPage.jsx` | `setStateMetaTags()`, inline JSON-LD |
| `scripts/generate-city-pages.js` | `buildHtml()` title, meta, OG, Twitter, JSON-LD |
| `src/components/CityAlertsPage.jsx` | `setCityMetaTags()`, `buildJsonLd()` |
| `index.html` | Homepage title, meta, OG, Twitter |
| `src/data/homepageMeta.js` | `HOMEPAGE_META` (SPA reset source of truth) |
| `src/components/RadarPage.jsx` | `setRadarMetaTags()` |
| `scripts/generate-static-pages.js` | `/radar` static HTML entry only |

---

## Potential SEO Risks

1. **Ranking volatility during re-indexing** — Title and description changes on 50+ state pages, city pages, and core routes may cause short-term ranking fluctuations while Google/Bing re-crawl and re-evaluate snippets.

2. **Brand name removal from titles** — Dropping `| StormTracking` / `StormTracking.io` from most titles reduces branded SERP recognition. Trade-off: more keyword-focused titles within Google's ~60-character display limit.

3. **Homepage keyword shift** — Moving away from "weather near me" phrasing in the title/meta may affect queries where that exact phrase ranked. New copy emphasizes "NWS alerts" and "live radar" instead.

4. **State SPA/static unification** — Previously static and runtime titles differed; unifying them eliminates a crawl vs. JS mismatch but changes whichever variant was indexed.

5. **City state abbreviation** — Titles now use `TX` instead of `Texas`, which may help local pack-style queries (`Houston TX weather alerts`) but could dilute full-state-name matches.

6. **Meta length** — All new meta descriptions are 131–144 characters, within the recommended ~150–160 range. Titles are 48–54 characters, well under the ~60-character SERP truncation threshold.

7. **Unchanged routes** — `/alerts` (all alerts) and `/prep` static meta in `generate-static-pages.js` were not updated in this pass; only `/radar` was in scope.

8. **Social share preview** — OG/Twitter images unchanged (homepage default; radar still uses dynamic `/api/og-image/radar` at runtime). Only text fields were updated.

---

## Deployment Note

Static HTML is regenerated at build time. After deploy, run the full build pipeline so `generate-state-pages.js`, `generate-city-pages.js`, and `generate-static-pages.js` rewrite `dist/` with the new meta tags.
