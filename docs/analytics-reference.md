# Analytics Reference

Source of truth for every Plausible event StormTracking fires, the props each event carries, and the typed constants that back them. **Keep this file in sync** with `src/utils/analytics.js` — every new event, source value, or trigger added there should land here too.

Last reviewed: 2026-06-17.

---

## Quick reference: Plausible goals

These are the events to register as goals in the Plausible dashboard. Properties (the `source`, `trigger`, etc. shown below) appear automatically in the Properties tab once events start flowing — they do not need to be pre-declared.

### Currently active goals

| Event | What it captures |
|---|---|
| `Radar Page View` | `/radar` mount — includes `source` and `state_context` |
| `Map Region Click` | Homepage StateHeatmap + MostImpactedStates clicks (unified — see below) |
| `State Alerts Page View` | Any state alert page mount |
| `State Quick Action Clicked` | Hero action cards on state pages — `action`: `radar`, `city`, or `county` |
| `Popular Location Clicked` | Popular location shortcut on state page — `state`, `city` |
| `Use My Location Clicked` | State-page GPS button — `state` |
| `State City Selected` | City combobox on state page — `state`, `city` |
| `State County Selected` | County combobox on state page — `state`, `county` |
| `Storm Page View` | Any storm event page mount |
| `Storm Banner Click` | Active storm banner on homepage |
| `storm_banner_viewed` | Active storm banner impression on homepage |
| `storm_banner_clicked` | Storm banner click (parallel product_events row) |
| `storm_page_viewed` | Storm event page mount (parallel product_events row) |
| `storm_radar_opened` | Radar CTA from storm page |
| `storm_alerts_clicked` | Live Alerts or state dropdown from storm page |
| `storm_location_saved` | Save location from storm page map popup |
| `storm_signin_started` | Sign-in modal opened from storm page |
| `Radar Link Click` | Click intent to navigate to `/radar` |
| `Browse By State Click` | State dropdown selection, "Weather Near Me" state chip, or county-polygon click (see `source`) |
| `Storm Radar Click` | "View Full Radar Map" CTA on storm pages |
| `Location Count Changed` | High-level saved-location count snapshot (`location_count`, `has_locations`) |
| `Location Added` | User intentionally saved a map pin (trigger, state, city, is_first_location) |
| `Location Added from Alert` | Save Location on map alert hover popup (`category`, state, city, is_first_location) |
| `Location Removed` | User intentionally removed a map pin (trigger, state, city, remaining_location_count) |
| `First Location Added` | Once per session when user saves their first pin |
| `Multiple Locations Reached` | User crosses 2, 3, or 5 saved pins in a session (multi-location demand signal) |
| `Geolocation Used` | "Find Weather Near Me" / "Use my location" GPS button — fired on permission grant (no props) |
| `Location Search Success` | State-page catalog search resolved (ZIP / city / county) — `query`, `state`, `resolved_type` |
| `Location Search Not Found` | State-page catalog search failed to resolve — `query`, `state` |
| `Visitor` | New-vs-returning classification — fired once per browser session on app mount (`visitor_type`, `visit_count`, `days_since_first_visit`) |
| `Sign Up Form Submitted` | First-time signup intent — magic link requested when `!hasAccountHint()` (`auth_method`); UI is unified "Sign In" but event still gates on per-device account hint |
| `Add To Home Page View` | `/add-to-home` mount — mobile install instructions (`source`; `sign_in_modal` when linked from SignInModal) |

### Gated behind `AFFILIATE_LINKS_ENABLED` (register now, will start firing post-launch)

| Event | What it captures |
|---|---|
| `Affiliate Click` | "Check on Amazon" CTA on `/prep` ProductCard |
| `Essentials Card Click` | Any product item inside an EssentialsCard placement |

---

## Clarifications

### "Map Region Click" vs "Heatmap State Click"

`Heatmap State Click` does **not** exist as a separate event. Heatmap and Most-Impacted-States interactions both fire `Map Region Click` with a `source` prop distinguishing them:

| Filter | Captures |
|---|---|
| `Map Region Click` where `source = "heatmap"` | StateHeatmap cell clicks |
| `Map Region Click` where `source = "most_impacted_list"` | MostImpactedStates row clicks |

Neither click navigates today — both just re-center the homepage map. This event captures **interest signal**, not action. If we ever add navigation affordances to these UIs, real nav sources will be added to `NAV_SOURCES` at that time.

### Location intent vs count snapshots

**Intent events** (`Location Added`, `Location Added from Alert`, `Location Removed`, `First Location Added`, `Multiple Locations Reached`) fire only from explicit UI handlers — never on localStorage hydration.

**Count snapshots** (`Location Count Changed`) fire from a `useEffect` in `App.jsx` on every `userLocations.length` change, including page load when saved pins are restored.

For trigger-level analysis, use `Location Added` / `Location Removed`. Map alert popup saves use the dedicated `Location Added from Alert` goal (not `Location Added` with `trigger = map_alert_popup`). For aggregate pin counts, use `Location Count Changed`.

See `docs/location-analytics-audit.md` for the full code-path audit and dashboard recommendations.

### New vs returning visitors (the `Visitor` event)

Plausible is cookieless and has **no native new-vs-returning dimension**, so we approximate it ourselves. On app mount, `trackVisitorType()` (in `analytics.js`) reads a small `localStorage` record (`st_visitor`: first-seen timestamp + session count) and fires one `Visitor` event per browser session. A `sessionStorage` flag (`st_visitor_seen`) caps it to one fire per session, so a visitor browsing five pages counts as **one** visit, not five — matching Plausible's session model.

How to read it in the dashboard:

| Filter | Captures |
|---|---|
| `Visitor` where `visitor_type = "new"` | First-ever session in this browser |
| `Visitor` where `visitor_type = "returning"` | Any later session |
| `visit_count` property | How many sessions this visitor has had (`1`, `2`, `3-5`, `6-10`, `11+`) |
| `days_since_first_visit` property | Recency of their first visit (`0`, `1-7`, `8-30`, `31-90`, `90+`) — good for seasonal-return analysis |

Numeric props are **bucketed** on purpose, so the Properties tab stays readable instead of scattering into dozens of one-off integer rows.

Caveats (inherent to any cookieless method): clearing site data, a different browser/device, or private-window browsing all read as a **new** visitor. Treat the new/returning split as a directional trend, not a precise person count.

---

## Event property reference

### Navigation events

```
State Alerts Page View
  stateCode      "FL", "TX", etc.
  stateName      "Florida", "Texas", etc.
  alertCount     number at the time of first non-loading render
  source         a value from NAV_SOURCES

Storm Page View
  stormName      e.g. "Plains & Midwest Severe Weather Outbreak — May 16-20, 2026"
  stormSlug      e.g. "plains-midwest-severe-outbreak-may-2026"
  stormType      e.g. "hurricane", "severe_weather", "winter_storm"
  stormStatus    e.g. "active", "forecasted", "completed"
  affectedStates comma-separated state abbrs
  source         a value from NAV_SOURCES

Radar Page View
  source         a value from NAV_SOURCES
  source_page    homepage | storm_page | state | city | county | other
  state_context  "national" (or a state slug if state-scoped radar is added later)

Storm Banner Click
  stormSlug
  stormName
  source         a value from NAV_SOURCES (homepage_banner today)

storm_banner_viewed / storm_banner_clicked / storm_page_viewed / storm_radar_opened /
storm_alerts_clicked / storm_location_saved / storm_signin_started
  storm_slug     storm slug, e.g. "tropical-storm-arthur-2026"
  storm_type     e.g. "tropical", "winter_storm", "severe_weather"
  visitor_type   "new" | "returning" (from st_visitor localStorage)
  source         NAV_SOURCES value when applicable
  destination    alerts path (storm_alerts_clicked only)
  trigger        save trigger (storm_location_saved only)
  source_page    "storm_page" on storm_radar_opened

Radar Link Click
  source         a value from NAV_SOURCES

Storm Radar Click
  stormSlug
  source         a value from NAV_SOURCES (storm_page_radar_link today)

Browse By State Click
  stateCode      "FL", "TX", etc.
  source         a value from NAV_SOURCES — the *_STATE_DROPDOWN values, plus
                 NEAR_ME_HEADER (the "Weather Near Me" state chip) and
                 MAP_COUNTY_CLICK (clicking the highlighted county polygon).
                 (NOTE: the homepage state grid still passes a raw "homepage_grid"
                 string — pre-existing drift, not yet promoted to a constant.)

Geolocation Used
  (no props)     Fired when the user grants the GPS prompt from a "Find Weather
                 Near Me" / "Use my location" button (NearMeHeader + StormMap).

Map Region Click
  state          state abbr ("FL", "TX", etc.)
  source         "heatmap" | "most_impacted_list"
```

### State alert page events

```
State Quick Action Clicked
  state          state abbr ("CT", "FL", etc.)
  action         "radar" | "city" | "county"

Popular Location Clicked
  state          state abbr
  city           city name label

Use My Location Clicked
  state          state abbr

State City Selected
  state          state abbr
  city           selected city name

State County Selected
  state          state abbr
  county         selected county name (without " County" suffix)
```

Hero cards scroll to on-page sections (radar map, Find Local Weather, county browse).
Popular locations and catalog selectors navigate to city/county alert pages.

### Location events

```
Location Count Changed
  location_count     number
  has_locations      "yes" | "no"

Location Added
  trigger            a value from SAVE_TRIGGERS
  state              normalized state slug
  city               present when parseable from "City, ST"
  is_first_location  boolean

Location Added from Alert
  category           alert category id (winter, flood, etc.)
  state              normalized state slug
  city               present when parseable from "City, ST"
  is_first_location  boolean

Location Removed
  trigger                  a value from SAVE_TRIGGERS
  state                    normalized state slug
  city                     present when parseable
  remaining_location_count number

First Location Added
  trigger            a value from SAVE_TRIGGERS
  state              normalized state slug
  city               present when parseable

Multiple Locations Reached
  location_count     2 | 3 | 5

Location Saved (legacy — not wired in UI)
  location_name
  location_type    "search" | "geolocation" | "alert"

Location Viewed on Map
  location_name

Location Search Success
  query              search string (ZIP, city name, or county name)
  state              state abbr ("CO", "TX", etc.)
  resolved_type      "zip" | "city" | "county"

Location Search Not Found
  query              search string that did not resolve
  state              state abbr
```

### Alert events

```
Alert Detail View
  alert_type   e.g. "Tornado Warning", "Winter Storm Watch"
  severity     NWS severity ("Extreme" | "Severe" | "Moderate" | "Minor" | "unknown")
  location     e.g. "Moore, OK"
  category     a category id (see ALERT_CATEGORY_VALUES below)

Alert Tapped
  category     a category id (see ALERT_CATEGORY_VALUES below)
  event        the NWS event string ("Tornado Warning", etc.)

Alert Added to Map
  category     a category id (see ALERT_CATEGORY_VALUES below)

Map Alert Clicked
  alert_type   the NWS event string
  location     e.g. "Moore, OK"
  category     a category id (see ALERT_CATEGORY_VALUES below)

Map Alert Hovered
  category     a category id (see ALERT_CATEGORY_VALUES below)

Category Expanded
  category_name   the category DISPLAY NAME (e.g. "Tornado", "Winter Weather")
  alert_count     number of alerts visible when expanded

Category Collapsed
  category_name   the category DISPLAY NAME (e.g. "Tornado", "Winter Weather")
  time_open_seconds   how long the category was open before collapse
```

**Important:** `category` (on Alert Tapped / Added to Map / Map events / Detail View) is the **category id** (lowercase slug, e.g. `tornado`). `category_name` (on Category Expanded / Collapsed) is the **display name** (e.g. `Tornado`). They are not interchangeable in Plausible filters.

### ALERT_CATEGORY_VALUES

The complete set of values the `category` prop can take, in display/safety-priority order (matches `CATEGORY_ORDER` in `shared/nws-alert-parser.js`):

| ID | Display name | NWS events covered |
|---|---|---|
| `tornado` | Tornado | Tornado Warning, Tornado Watch |
| `tropical` | Tropical | Hurricane, Tropical Storm, Storm Surge |
| `severe` | Severe Storms | Severe Thunderstorm, High Wind, Wind Advisory |
| `winter` | Winter Weather | Blizzard, Ice Storm, Winter Storm, Heavy Snow, Wind Chill, Freeze, etc. |
| `flood` | Flooding | Flash Flood, Flood, Coastal Flood |
| `heat` | Extreme Heat | Excessive Heat, Heat Advisory |
| `fire` | Fire Weather | Red Flag, Fire Weather, Fire Warning |

History note: prior to the 2026-05 tornado category split, tornado events were classified as `severe`. Historical Plausible data filtered on `category=tornado` will be empty before that date — past tornado activity is bucketed under `severe`.

### Forecast events

```
Forecast Page View
  state            state slug (e.g. "oklahoma")
  location_source  "state-default" | "city" | "zip"
                   (geolocation picks don't update the URL, so initial
                   page-view source can only be one of these three;
                   later picker interactions don't refire this event)

Forecast Location Changed
  source           "city" | "zip" | "geolocation"
                   The picker mode the user used after initial mount.
                   Pair with Forecast Page View to see which modes are
                   actually used vs. just available.

Forecast Link Click
  source             "city-page" | "state-page-widget"
                     Where the click came from.
  destination_state  state slug being navigated to
  destination_type   "city" | "zip" | "state-default"
                     What kind of forecast destination was clicked.
```

`Forecast Page View` fires once per /forecast/[state-slug] mount. Captures
which states get traffic and which picker mode the user landed with.

`Forecast Location Changed` fires when the user changes location via the
picker on the forecast page itself. Lets us see which picker mode
(city dropdown vs ZIP vs geolocation) gets used in practice — informs
catalog expansion vs ZIP UX investment.

`Forecast Link Click` fires from entry points on other surfaces
(CityAlertsPage "View full forecast" CTA, StateForecastWidget on state
alert pages). Pairs with Forecast Page View on the landing side to
measure the entry funnel.

### SEO / indexing events

```
IndexNow Submission
  source       'admin_state_pages' | 'admin_storm_pages' | 'admin_core_pages' |
               'admin_custom' | 'build_sitemap' (Session 2 — build-time hook)
  urls_count   number of URLs in the submission
  success      boolean — whether the IndexNow API returned 200/202
```

Fires from `/admin/seo` bulk-submit buttons and (Session 2) the build-time
hook in `scripts/generate-sitemap.js`. Use it to track how often submissions
happen and what the success rate looks like — failures usually mean the
verification file isn't accessible or the IndexNow API is rate-limiting.

### Auth events

```
Sign Up Form Submitted
  auth_method    "magic_link" (default — v1 is passwordless email only)

Add To Home Page View
  source         a value from NAV_SOURCES (sign_in_modal when linked from
                 SignInModal on mobile; direct_url / internal_link / etc.
                 otherwise via resolveSource)

Alert Signup
  signup_type    "new" | "update"
  zip_code       5-digit ZIP (no email — PII avoided)

Alert Signup Error
  error          error message string
```

`Sign Up Form Submitted` fires from `SignInModal` only when `!hasAccountHint()` —
and only after Supabase accepts the OTP request (not on validation errors or API
failures). Users who have completed sign-in on this device before (`st_account_known`)
do **not** fire this event when requesting another magic link. Distinct from alert
signup goals so the new-account funnel can be tracked separately.

### Affiliate events (gated)

```
Affiliate Click
  product     productId from src/data/affiliateProducts.js (e.g. "midland-er310")
  category    category id (e.g. "stay-informed")
  tier        "S" | "A" | "B" | "C"
  placement   typically "prep-page"
  merchant    "amazon" (default — function-level fallback). Future values
              when we expand beyond Amazon: "walmart", "rei", etc.

Essentials Card Click
  product     productId (or "view-full-guide" for the bottom link)
  placement   "homepage" | "state-fl" | "state-tx" | "state-tornado" | "storm-hurricane" | "storm-severe"
  destination "prep-page"
```

---

## Constants — the typed values

### NAV_SOURCES

Always import and use these constants from `src/utils/analytics.js`. Never hardcode source strings — that creates dashboard noise from typos/casing drift and breaks the audit chain.

```
// Homepage origins
HOMEPAGE_BANNER             "homepage_banner"           Active storm banner above the map
HOMEPAGE_ALERT_POPUP        "homepage_alert_popup"      State link inside map alert hover popup
HOMEPAGE_STATE_DROPDOWN     "homepage_state_dropdown"   Header "State Weather/Radar" select on /
HOMEPAGE_RADAR_WIDGET       "homepage_radar_widget"     "Explore Radar Maps" CTA
HOMEPAGE_QUICK_LINK         "homepage_quick_link"

// Inline state dropdowns on non-homepage pages
STATE_PAGE_STATE_DROPDOWN   "state_page_state_dropdown"
RADAR_PAGE_STATE_DROPDOWN   "radar_page_state_dropdown"
STORM_PAGE_STATE_DROPDOWN   "storm_page_state_dropdown"

// State-page outbound nav
STATE_PAGE_RADAR_LINK       "state_page_radar_link"
STATE_PAGE_STORM_LINK       "state_page_storm_link"

// Storm-page outbound nav
STORM_PAGE_LINK             "storm_page_link"
STORM_PAGE_RADAR_LINK       "storm_page_radar_link"

// Radar-page outbound nav
RADAR_PAGE_LINK             "radar_page_link"

// "Weather Near Me" feature → state alerts page
NEAR_ME_HEADER              "near_me_header"            "{State} alerts & city forecasts" chip
MAP_COUNTY_CLICK            "map_county_click"          Highlighted "your area" county polygon

// Auth / onboarding
SIGN_IN_MODAL               "sign_in_modal"             Add-to-home link in SignInModal (mobile)

// Generic
HEADER_NAVIGATION           "header_navigation"
FOOTER_LINK                 "footer_link"
INTERNAL_LINK               "internal_link"
ESSENTIALS_CARD             "essentials_card"
STATE_DIRECTORY_PAGE        "state_directory_page"
DIRECT_URL                  "direct_url"
SEARCH_ENGINE               "search_engine"
SOCIAL_REFERRAL             "social_referral"
```

### SAVE_TRIGGERS

```
CHECK_LOCATION_BUTTON       "check_location_button"   — ZIP/city search Add to Map toggle
YOUR_LOCATIONS_WIDGET       "your_locations_widget"   — reserved
YOUR_LOCATIONS_REMOVE       "your_locations_remove"   — × in Your Locations list
ALERT_ADD_TO_MAP            "alert_add_to_map"        — Live Alert card Add to Map
MAP_ALERT_POPUP             "map_alert_popup"         — Save Location on map alert hover popup (fires Location Added from Alert, not Location Added)
MAP_LOCATION_PIN_CLICK      "map_location_pin_click"  — reserved
AUTO_GEOLOCATE              "auto_geolocate"          — reserved
```

`STATE_PAGE_SAVE_BUTTON` is intentionally omitted — state pages have no save button today. Add the constant when the feature is built.

### MAP_REGION_SOURCES

```
HEATMAP                     "heatmap"
MOST_IMPACTED_LIST          "most_impacted_list"
```

---

## Supabase product + radar events

These rows land in `product_events` / `radar_events` via `productAnalyticsService.js`. They power the admin Product Analysis dashboard.

### Radar events (`radar_events`)

```
radar_opened
  state_code     2-letter abbr or US sentinel when no state at open time (unchanged)
  radar_type     e.g. "precipitation"

radar_location_changed / radar_type_changed / radar_toggled
  (unchanged — see productAnalyticsService.js dedupe table)
```

`radar_opened` still fires immediately on map mount. When no state is known yet, `state_code` is stored as `US` (national sentinel) — this is an **unresolved** session, not proof the user chose a national view.

### Radar state resolution (`product_events`)

```
radar_state_resolved
  state_code           2-letter abbr (resolved state)
  metadata.source      gps | search | deep_link | saved_location | manual_state_select
  metadata.seconds_after_open   seconds from first radar_opened in session to resolve
```

Fires **once per session** when a radar session that opened unresolved (`US`) later gains a state (homepage map, `/radar`, etc.). Does not fire when radar opens with a state already attached (e.g. state alert pages).

Admin dashboard labels the `US` sentinel as **Unresolved Location** (subtitle: default US view).

### RADAR_RESOLUTION_SOURCES

```
GPS                    "gps"                     GPS / Use My Location
SEARCH                 "search"                  ZIP or city search resolved a state
DEEP_LINK              "deep_link"               /radar?lat=&lon= deep link
SAVED_LOCATION         "saved_location"          Saved pin re-centered map
MANUAL_STATE_SELECT    "manual_state_select"     State zoom / manual state pick on map
```

---

## How source-stashing works

Every navigation event records HOW the user got there via a `source` prop. The mechanism:

1. **Button click handler** calls `setNavSource(NAV_SOURCES.X)` immediately before `navigate(...)`. The source is stashed in `sessionStorage` under `st_nav_source`.
2. **Destination page mount-effect** fires `trackXPageView(...)`. The helper internally calls `resolveSource()` which reads + clears the stashed flag.
3. **Direct URL / bookmark / external referral** — no flag is set, so `resolveSource()` falls back to `detectSourceFromReferrer()` which categorizes into `INTERNAL_LINK`, `SEARCH_ENGINE`, `SOCIAL_REFERRAL`, or `DIRECT_URL`.

Result: one event per visit, source always captured, no duplication.

The flag is single-use — read clears it — so a stale source from one navigation can't poison the next page view.

---

## How to add a new event

1. Add a new `track('Event Name', { ...props })` helper function in `src/utils/analytics.js`. Use existing helpers as a template.
2. Add the helper to the `export default {...}` block at the bottom of the file.
3. Call the helper from the UI site.
4. **Update this file** with the new event name and prop list.
5. Register the new event as a goal in the Plausible dashboard.

## How to add a new source value

1. Add a constant to `NAV_SOURCES` (or `SAVE_TRIGGERS` / `MAP_REGION_SOURCES`) in `src/utils/analytics.js`.
2. Call `setNavSource(NAV_SOURCES.YOUR_NEW_SOURCE)` from the button handler (or pass it directly to the event helper).
3. **Update this file** with the new constant.

No change needed in the destination page — it already reads the flag.

---

## Related files

- `src/utils/analytics.js` — implementation (canonical source of truth)
- `src/services/productAnalyticsService.js` — Supabase product + radar funnel writes
- `src/data/affiliateProducts.js` — `productId` values used by Affiliate Click / Essentials Card Click events
- `src/config/featureFlags.js` — `AFFILIATE_LINKS_ENABLED` gating
