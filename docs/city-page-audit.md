# City Alert Page Audit

Coverage audit for StormTracking.io city alert pages before generating additional content. **No pages were created** — analysis only.

Last reviewed: 2026-06-08.

---

## How city pages work

| Layer | Path / pattern | Role |
|---|---|---|
| **Route** | `/alerts/:slug` | Single flat slug; shared with state pages |
| **Dispatch** | `AlertsRouteDispatch.jsx` | State slug → `StateAlertsPage`; city slug → `CityAlertsPage` |
| **Rich data** | `src/content/cities/*.json` (50 files) | Full SEO + NWS zone + coordinates |
| **Routing index** | `src/content/cities/index.json` | Authoritative list of routable city slugs |
| **Static HTML** | `dist/alerts/{slug}/index.html` | Build-time pre-render via `scripts/generate-city-pages.js` |
| **Sitemap** | `scripts/generate-sitemap.js` | Emits `https://stormtracking.io/alerts/{slug}` per rich JSON |
| **Forecast-only** | `src/data/cityCatalog.js` → `FORECAST_PICKER_FILL` (27 cities) | Picker + `/forecast/{state}?city=` only — **no alert page** |
| **Storm tracker** | `src/config/cities.js` (12 cities) | Homepage storm-event city cards — **not linked to alert pages** |

**Slug convention:** `{city-name-hyphenated}-{state-abbr-lowercase}` (e.g. `oklahoma-city-ok`, `st-louis-mo`).

There are **no** nested routes like `/alerts/texas/dallas` and **no** per-city React route files — all cities are dynamic via one route + JSON content.

---

## Existing City Pages

50 cities across **28 US states**. All use route pattern `/alerts/{slug}`.

| City | State | Route |
| --- | --- | --- |
| Albany | NY | /alerts/albany-ny |
| Birmingham | AL | /alerts/birmingham-al |
| Boston | MA | /alerts/boston-ma |
| Buffalo | NY | /alerts/buffalo-ny |
| Burlington | VT | /alerts/burlington-vt |
| Charleston | SC | /alerts/charleston-sc |
| Chicago | IL | /alerts/chicago-il |
| Cincinnati | OH | /alerts/cincinnati-oh |
| Cleveland | OH | /alerts/cleveland-oh |
| Columbus | OH | /alerts/columbus-oh |
| Dallas | TX | /alerts/dallas-tx |
| Des Moines | IA | /alerts/des-moines-ia |
| Detroit | MI | /alerts/detroit-mi |
| Fort Myers | FL | /alerts/fort-myers-fl |
| Fort Worth | TX | /alerts/fort-worth-tx |
| Grand Rapids | MI | /alerts/grand-rapids-mi |
| Hartford | CT | /alerts/hartford-ct |
| Houston | TX | /alerts/houston-tx |
| Indianapolis | IN | /alerts/indianapolis-in |
| Jacksonville | FL | /alerts/jacksonville-fl |
| Joplin | MO | /alerts/joplin-mo |
| Kansas City | MO | /alerts/kansas-city-mo |
| Lincoln | NE | /alerts/lincoln-ne |
| Little Rock | AR | /alerts/little-rock-ar |
| Memphis | TN | /alerts/memphis-tn |
| Miami | FL | /alerts/miami-fl |
| Milwaukee | WI | /alerts/milwaukee-wi |
| Minneapolis | MN | /alerts/minneapolis-mn |
| Mobile | AL | /alerts/mobile-al |
| Nashville | TN | /alerts/nashville-tn |
| New Orleans | LA | /alerts/new-orleans-la |
| New York | NY | /alerts/new-york-ny |
| Oklahoma City | OK | /alerts/oklahoma-city-ok |
| Omaha | NE | /alerts/omaha-ne |
| Orlando | FL | /alerts/orlando-fl |
| Pensacola | FL | /alerts/pensacola-fl |
| Philadelphia | PA | /alerts/philadelphia-pa |
| Pittsburgh | PA | /alerts/pittsburgh-pa |
| Portland | ME | /alerts/portland-me |
| Providence | RI | /alerts/providence-ri |
| Rochester | NY | /alerts/rochester-ny |
| Savannah | GA | /alerts/savannah-ga |
| Springfield | MO | /alerts/springfield-mo |
| St. Louis | MO | /alerts/st-louis-mo |
| Syracuse | NY | /alerts/syracuse-ny |
| Tampa | FL | /alerts/tampa-fl |
| Tulsa | OK | /alerts/tulsa-ok |
| Virginia Beach | VA | /alerts/virginia-beach-va |
| Wichita | KS | /alerts/wichita-ks |
| Wilmington | NC | /alerts/wilmington-nc |

---

## Missing High-Priority Cities

Comparison against the requested priority metro list. **Coverage: 28 of 47 (60%).**

### Texas (3 / 6)

| City | Status | Route if exists |
| --- | --- | --- |
| Dallas | ✅ Exists | /alerts/dallas-tx |
| Houston | ✅ Exists | /alerts/houston-tx |
| Fort Worth | ✅ Exists | /alerts/fort-worth-tx |
| Austin | ❌ Missing | — |
| San Antonio | ❌ Missing | — |
| El Paso | ❌ Missing | — |

### Florida (5 / 6)

| City | Status | Route if exists |
| --- | --- | --- |
| Miami | ✅ Exists | /alerts/miami-fl |
| Tampa | ✅ Exists | /alerts/tampa-fl |
| Orlando | ✅ Exists | /alerts/orlando-fl |
| Jacksonville | ✅ Exists | /alerts/jacksonville-fl |
| Fort Myers | ✅ Exists | /alerts/fort-myers-fl |
| St Petersburg | ❌ Missing | — |

### Illinois (1 / 3)

| City | Status | Route if exists |
| --- | --- | --- |
| Chicago | ✅ Exists | /alerts/chicago-il |
| Aurora | ❌ Missing | — |
| Rockford | ❌ Missing | — |

### Ohio (3 / 4)

| City | Status | Route if exists |
| --- | --- | --- |
| Columbus | ✅ Exists | /alerts/columbus-oh |
| Cleveland | ✅ Exists | /alerts/cleveland-oh |
| Cincinnati | ✅ Exists | /alerts/cincinnati-oh |
| Toledo | ❌ Missing | — |

### Pennsylvania (2 / 3)

| City | Status | Route if exists |
| --- | --- | --- |
| Philadelphia | ✅ Exists | /alerts/philadelphia-pa |
| Pittsburgh | ✅ Exists | /alerts/pittsburgh-pa |
| Allentown | ❌ Missing | — |

### Michigan (2 / 3)

| City | Status | Route if exists |
| --- | --- | --- |
| Detroit | ✅ Exists | /alerts/detroit-mi |
| Grand Rapids | ✅ Exists | /alerts/grand-rapids-mi |
| Lansing | ❌ Missing | — |

### Missouri (3 / 3) ✅

| City | Status | Route |
| --- | --- | --- |
| Kansas City | ✅ Exists | /alerts/kansas-city-mo |
| St Louis | ✅ Exists | /alerts/st-louis-mo |
| Springfield | ✅ Exists | /alerts/springfield-mo |

### Kansas (1 / 3)

| City | Status | Route if exists |
| --- | --- | --- |
| Wichita | ✅ Exists | /alerts/wichita-ks |
| Topeka | ❌ Missing | — |
| Overland Park | ❌ Missing | — |

### Oklahoma (2 / 2) ✅

| City | Status | Route |
| --- | --- | --- |
| Oklahoma City | ✅ Exists | /alerts/oklahoma-city-ok |
| Tulsa | ✅ Exists | /alerts/tulsa-ok |

### Indiana (1 / 2)

| City | Status | Route if exists |
| --- | --- | --- |
| Indianapolis | ✅ Exists | /alerts/indianapolis-in |
| Fort Wayne | ❌ Missing | — |

### Tennessee (2 / 3)

| City | Status | Route if exists |
| --- | --- | --- |
| Nashville | ✅ Exists | /alerts/nashville-tn |
| Memphis | ✅ Exists | /alerts/memphis-tn |
| Knoxville | ❌ Missing | — |

### North Carolina (0 / 3)

| City | Status | Notes |
| --- | --- | --- |
| Charlotte | ❌ Missing | NC has only Wilmington today |
| Raleigh | ❌ Missing | Referenced in `src/config/cities.js` storm tracker, no alert page |
| Greensboro | ❌ Missing | — |

### South Carolina (1 / 2)

| City | Status | Route if exists |
| --- | --- | --- |
| Charleston | ✅ Exists | /alerts/charleston-sc |
| Columbia | ❌ Missing | — |

### Georgia (1 / 2)

| City | Status | Notes |
| --- | --- | --- |
| Savannah | ✅ Exists | /alerts/savannah-ga |
| Atlanta | ❌ Missing | Referenced in `src/config/cities.js` storm tracker, no alert page |

### Louisiana (1 / 2)

| City | Status | Route if exists |
| --- | --- | --- |
| New Orleans | ✅ Exists | /alerts/new-orleans-la |
| Baton Rouge | ❌ Missing | — |

### Summary of 19 missing priority metros

Austin TX · San Antonio TX · El Paso TX · St Petersburg FL · Aurora IL · Rockford IL · Toledo OH · Allentown PA · Lansing MI · Topeka KS · Overland Park KS · Fort Wayne IN · Knoxville TN · Charlotte NC · Raleigh NC · Greensboro NC · Columbia SC · Atlanta GA · Baton Rouge LA

---

## Coverage Statistics

### Totals

| Metric | Count |
| --- | ---: |
| **US state alert pages** (all states in `stateConfig.js`) | 50 |
| **States with ≥1 city alert page** | 28 |
| **States with zero city alert pages** | 22 |
| **Total city alert pages (rich catalog)** | 50 |
| **Forecast-picker-only cities (no alert page)** | 27 |
| **Storm-tracker cities (`config/cities.js`, no alert page)** | 2 of 12 lack pages (Atlanta, Raleigh) |

### Cities per state (states with coverage)

| State | Cities | City names |
| --- | ---: | --- |
| FL | 6 | Fort Myers, Jacksonville, Miami, Orlando, Pensacola, Tampa |
| NY | 5 | Albany, Buffalo, New York, Rochester, Syracuse |
| MO | 4 | Joplin, Kansas City, Springfield, St. Louis |
| OH | 3 | Cincinnati, Cleveland, Columbus |
| TX | 3 | Dallas, Fort Worth, Houston |
| AL | 2 | Birmingham, Mobile |
| MI | 2 | Detroit, Grand Rapids |
| NE | 2 | Lincoln, Omaha |
| OK | 2 | Oklahoma City, Tulsa |
| PA | 2 | Philadelphia, Pittsburgh |
| TN | 2 | Memphis, Nashville |
| AR, CT, GA, IA, IL, IN, KS, LA, MA, ME, MN, NC, RI, SC, VA, VT, WI | 1 each | See table above |

### Missing cities per state (priority list only)

| State | Missing from priority list |
| --- | --- |
| TX | Austin, San Antonio, El Paso |
| FL | St Petersburg |
| IL | Aurora, Rockford |
| OH | Toledo |
| PA | Allentown |
| MI | Lansing |
| KS | Topeka, Overland Park |
| IN | Fort Wayne |
| TN | Knoxville |
| NC | Charlotte, Raleigh, Greensboro |
| SC | Columbia |
| GA | Atlanta |
| LA | Baton Rouge |
| MO, OK | — (complete) |

### States with **no** city alert pages (22)

AK, AZ, CA, CO, DE, HI, ID, KY, MD, MS, MT, NV, NH, NJ, NM, ND, OR, SD, UT, WA, WV, WY

Each of these has a **state** alert page (`/alerts/{state-slug}`) and a **forecast** page, but no city-level `/alerts/{city-slug}` until a rich JSON file is added. Most have a forecast-picker placeholder city in `FORECAST_PICKER_FILL` (e.g. Phoenix, Los Angeles, Seattle).

---

## Tier 1 (Highest Priority)

Cities in **Tornado Alley**, **Dixie Alley**, **Gulf Coast hurricane regions**, or **large metros in currently underserved high-traffic states**.

| City | State | Region rationale |
| --- | --- | --- |
| Atlanta | GA | Dixie Alley; largest SE metro; already in storm tracker config |
| Charlotte | NC | Major metro; NC has no priority-city coverage |
| Raleigh | NC | State capital; storm tracker config; Research Triangle |
| Austin | TX | Major TX gap; severe hail/tornado |
| San Antonio | TX | Major TX gap; flash flood / severe |
| El Paso | TX | West TX severe / monsoon edge |
| Greensboro | NC | Piedmont severe / ice |
| Columbia | SC | State capital; Dixie Alley |
| Knoxville | TN | Dixie Alley / East TN severe |
| St Petersburg | FL | Tampa Bay; Gulf hurricane exposure |
| Baton Rouge | LA | Gulf Coast hurricane / flood |
| Topeka | KS | Tornado Alley state capital |
| Overland Park | KS | KC metro; Tornado Alley |
| Fort Wayne | IN | Midwest severe / winter |
| Joplin-adjacent gap | — | Joplin exists; Springfield MO exists — KS secondary metros are the gap |

**Strongest existing Tier-1 coverage:** OK (complete), MO (complete), FL (5/6), core Tornado Alley anchors (OKC, Tulsa, Wichita, KC, St. Louis, Joplin, Springfield).

---

## Tier 2 (Major metros)

Remaining large metros — high population / search volume, often already in `FORECAST_PICKER_FILL` (easy promotion path).

| City | State | Notes |
| --- | --- | --- |
| Los Angeles | CA | Forecast fill `los-angeles-ca`; largest US metro without alert page |
| Phoenix | AZ | Forecast fill; monsoon market |
| Denver | CO | Forecast fill; hail alley |
| Seattle | WA | Forecast fill; PNW weather interest |
| Washington | DC | Forecast fill `washington-dc`; storm tracker references DC |
| Baltimore | MD | Forecast fill; mid-Atlantic severe |
| Las Vegas | NV | Forecast fill |
| Portland | OR | Forecast fill |
| Louisville | KY | Forecast fill; Ohio Valley severe |
| San Francisco | CA | Forecast fill (second CA metro) |
| Newark | NJ | Forecast fill; NYC metro spillover |
| Lansing | MI | State capital gap |
| Toledo | OH | Great Lakes severe gap |
| Allentown | PA | Lehigh Valley gap |
| Aurora | IL | Chicago metro |
| Rockford | IL | Northern IL severe |

---

## Tier 3 (Secondary cities)

Smaller metros, state-capital fills, and territorial coverage. Lower immediate traffic upside but improve state-level completeness.

| City | State | Source |
| --- | --- | --- |
| Anchorage | AK | Forecast fill |
| Boise | ID | Forecast fill |
| Albuquerque | NM | Forecast fill |
| Fargo | ND | Forecast fill |
| Sioux Falls | SD | Forecast fill |
| Billings | MT | Forecast fill |
| Cheyenne | WY | Forecast fill |
| Manchester | NH | Forecast fill |
| Wilmington | DE | Forecast fill (name collision with Wilmington NC) |
| Jackson | MS | Forecast fill |
| Charleston | WV | Forecast fill |
| Honolulu | HI | Forecast fill |
| San Juan | PR | Forecast fill |
| Hagåtña | GU | Forecast fill |
| Charlotte Amalie | VI | Forecast fill |

---

## Sitemap & SEO Coverage

### Sitemap (`scripts/generate-sitemap.js`)

| Check | Status | Details |
| --- | --- | --- |
| Every rich city in sitemap | ✅ Pass | All 50 `src/content/cities/*.json` files (excl. `index.json`) emit `/alerts/{slug}` at priority `0.7` |
| `index.json` ↔ JSON files in sync | ✅ Pass | 50 slugs in both; zero mismatches |
| Forecast-fill cities in sitemap | ❌ N/A | Intentionally excluded — no alert pages |
| State pages in sitemap | ✅ Pass | 54 slugs (50 states + DC + 3 territories) |

**Note:** `public/_redirects` references a Netlify `sitemap` function that is not present in the repo; production relies on build-time `dist/sitemap.xml`.

### Canonical URLs

| Check | Status | Details |
| --- | --- | --- |
| Build-time canonical | ✅ Pass | `generate-city-pages.js` sets `https://stormtracking.io/alerts/{slug}` |
| Runtime canonical (SPA nav) | ✅ Pass | `CityAlertsPage.setCityMetaTags()` |
| `og:url` alignment | ✅ Pass | Same URL as canonical |

### Internal linking

| Source | Links to city pages? | Coverage |
| --- | --- | --- |
| State alert pages (`CityDirectory`) | ✅ | Only for states with cities in `index.json` (28 states) |
| State map city markers (`StormMap`) | ✅ | Same 28 states via `citiesWithCoordsForState` |
| City page `nearby_cities` | ✅ | Cross-links between rich cities |
| City breadcrumbs | ✅ | → `/alerts` → `/alerts/{state_slug}` |
| Homepage `NearMeHeader` | ✅ | `/alerts/{slug}` when geo resolves to catalogued city |
| `LiveAlertCard` inline links | ✅ | `findCitySlugInText()` → catalogued cities only |
| Forecast picker | ⚠️ Partial | Rich cities → could link alerts; fill cities → `/forecast/` only |
| Admin IndexNow bulk | ⚠️ Gap | No one-click city URL bulk submit |

### Crawlability

| Check | Status | Details |
| --- | --- | --- |
| Static HTML per city | ✅ Pass | `dist/alerts/{slug}/index.html` at build |
| Route dispatch | ✅ Pass | `CITY_SLUGS` from `index.json` |
| Bot OG tags (edge) | ⚠️ Partial | `og-rewrite.js` handles **state** slugs only; city crawlers rely on static HTML |
| 22 states without `CityDirectory` | ⚠️ Gap | No state→city link grid; users must search or land via external links |

---

## Routing & data source reference

```
src/main.jsx
  /alerts/:slug → AlertsRouteDispatch
    ├─ SLUG_TO_ABBR[slug]     → StateAlertsPage   (/alerts/texas)
    ├─ CITY_SLUGS.has(slug)   → CityAlertsPage    (/alerts/dallas-tx)
    └─ else                   → 404 UI

src/content/cities/{slug}.json  → rich page data
src/content/cities/index.json   → routing + cityLookup + CitiesInState
src/data/cityCatalog.js         → forecast picker (rich + fill merge)
src/utils/cityLookup.js         → "City, ST" → slug for dynamic links
scripts/generate-city-pages.js  → static HTML
scripts/generate-sitemap.js     → sitemap URLs
```

### Adding a new city (workflow)

1. Create `src/content/cities/{slug}.json` (full schema)
2. Add entry to `src/content/cities/index.json`
3. Rebuild — sitemap, static HTML, routing, and `CityDirectory` update automatically
4. Remove duplicate from `FORECAST_PICKER_FILL` if promoting from forecast-only

---

## Top 25 City Pages to Build Next

Ranked by **expected traffic opportunity** (metro size + search demand), **severe-weather relevance** (Tornado Alley, Dixie Alley, Gulf Coast), and **coverage gap severity**.

| Rank | City | State | Proposed slug | Rationale |
| ---: | --- | --- | --- | --- |
| 1 | Atlanta | GA | `atlanta-ga` | Largest missing SE metro; Dixie Alley; already in storm tracker |
| 2 | Charlotte | NC | `charlotte-nc` | Largest NC metro; zero priority NC coverage |
| 3 | Raleigh | NC | `raleigh-nc` | State capital; storm tracker city; Research Triangle |
| 4 | Austin | TX | `austin-tx` | Top-10 US metro; TX only 50% on priority list |
| 5 | San Antonio | TX | `san-antonio-tx` | Major TX gap; flash flood / severe market |
| 6 | Los Angeles | CA | `los-angeles-ca` | Largest US metro; forecast fill ready to promote |
| 7 | St Petersburg | FL | `st-petersburg-fl` | Tampa Bay; completes FL priority list |
| 8 | El Paso | TX | `el-paso-tx` | Completes TX priority list; border desert severe |
| 9 | Greensboro | NC | `greensboro-nc` | NC Piedmont; completes NC priority triad |
| 10 | Columbia | SC | `columbia-sc` | State capital; Dixie Alley |
| 11 | Baton Rouge | LA | `baton-rouge-la` | Gulf hurricane / flood; state capital |
| 12 | Phoenix | AZ | `phoenix-az` | Top-5 US metro; monsoon; forecast fill ready |
| 13 | Washington | DC | `washington-dc` | Capital region; forecast fill; storm tracker adjacent |
| 14 | Denver | CO | `denver-co` | Hail alley; forecast fill ready |
| 15 | Seattle | WA | `seattle-wa` | Major PNW metro; forecast fill ready |
| 16 | Baltimore | MD | `baltimore-md` | Mid-Atlantic severe; storm tracker city |
| 17 | Knoxville | TN | `knoxville-tn` | Dixie Alley; completes TN priority gap |
| 18 | Topeka | KS | `topeka-ks` | Tornado Alley state capital |
| 19 | Fort Wayne | IN | `fort-wayne-in` | Secondary IN severe market |
| 20 | Louisville | KY | `louisville-ky` | Ohio Valley severe; forecast fill ready |
| 21 | Overland Park | KS | `overland-park-ks` | KC metro Tornado Alley suburb |
| 22 | Lansing | MI | `lansing-mi` | MI state capital gap |
| 23 | Toledo | OH | `toledo-oh` | Great Lakes severe; completes OH gap |
| 24 | Aurora | IL | `aurora-il` | Chicago metro; Midwest tornado / derecho |
| 25 | Allentown | PA | `allentown-pa` | Lehigh Valley; completes PA priority list |

### Quick wins (ranks 6, 12–16, 20)

Los Angeles, Phoenix, Denver, Seattle, Washington DC, Baltimore, and Louisville already exist in `FORECAST_PICKER_FILL` with slug, coordinates, and state metadata — promotion requires authoring rich JSON (NWS zone, descriptions) rather than inventing routes from scratch.

### Highest-impact batch (first 10)

Building ranks **1–10** would close the entire **North Carolina** priority gap, add **Atlanta**, complete **Texas** priority coverage except none remaining after El Paso, finish **Florida** priority list, and cover **SC / LA** state-capital gaps — the largest concentration of missing high-intent severe-weather metros.

---

## Appendix: Forecast-picker cities without alert pages

These 27 cities appear in the forecast dropdown but **do not** have `/alerts/{slug}` pages:

Anchorage AK · Phoenix AZ · Los Angeles CA · San Francisco CA · Denver CO · Wilmington DE · Honolulu HI · Boise ID · Louisville KY · Baltimore MD · Jackson MS · Billings MT · Las Vegas NV · Manchester NH · Newark NJ · Albuquerque NM · Fargo ND · Portland OR · Sioux Falls SD · Salt Lake City UT · Seattle WA · Charleston WV · Cheyenne WY · Washington DC · San Juan PR · Charlotte Amalie VI · Hagåtña GU

---

## Appendix: Storm tracker cities vs alert pages

`src/config/cities.js` defines 12 storm-path cities for homepage event tracking. Two lack alert pages despite being major metros:

| Storm config city | Alert page |
| --- | --- |
| Atlanta, GA | ❌ Missing |
| Raleigh, NC | ❌ Missing |
| Dallas, Memphis, St. Louis, Indianapolis, Cincinnati, DC, Baltimore, Philadelphia, NYC, Boston | ✅ Exist |

Consider prioritizing Atlanta and Raleigh to align storm-event UX with destination alert pages.
