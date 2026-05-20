# Analytics Reference

Source of truth for every Plausible event StormTracking fires, the props each event carries, and the typed constants that back them. **Keep this file in sync** with `src/utils/analytics.js` — every new event, source value, or trigger added there should land here too.

Last reviewed: 2026-05-20.

---

## Quick reference: Plausible goals

These are the events to register as goals in the Plausible dashboard. Properties (the `source`, `trigger`, etc. shown below) appear automatically in the Properties tab once events start flowing — they do not need to be pre-declared.

### Currently active goals

| Event | What it captures |
|---|---|
| `Radar Page View` | `/radar` mount — includes `source` and `state_context` |
| `Map Region Click` | Homepage StateHeatmap + MostImpactedStates clicks (unified — see below) |
| `State Alerts Page View` | Any state alert page mount |
| `Storm Page View` | Any storm event page mount |
| `Storm Banner Click` | Active storm banner on homepage |
| `Radar Link Click` | Click intent to navigate to `/radar` |
| `Browse By State Click` | Any state dropdown selection |
| `Storm Radar Click` | "View Full Radar Map" CTA on storm pages |
| `Location Count Changed` | Saved-location add/remove (count + trigger context) |

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

### Why some location events fire twice

`Location Count Changed` fires from two paths:

1. **Count-change useEffect** in `App.jsx` — fires on every change to `userLocations.length`. Props: `location_count`, `has_locations`.
2. **Rich helper `trackLocationChange()`** at explicit UI handlers (currently only `ZipCodeSearch` toggle). Props: `action`, `trigger`, `location_state`, `is_first_location`.

To analyze rich trigger data in Plausible, filter for events that have an `action` prop. The count-change events have an empty `action`.

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
  state_context  "national" (or a state slug if state-scoped radar is added later)

Storm Banner Click
  stormSlug
  stormName
  source         a value from NAV_SOURCES (homepage_banner today)

Radar Link Click
  source         a value from NAV_SOURCES

Storm Radar Click
  stormSlug
  source         a value from NAV_SOURCES (storm_page_radar_link today)

Browse By State Click
  stateCode      "FL", "TX", etc.
  source         a value from NAV_SOURCES (one of the *_STATE_DROPDOWN values today)

Map Region Click
  state          state abbr ("FL", "TX", etc.)
  source         "heatmap" | "most_impacted_list"
```

### Location events

```
Location Count Changed
  Path A (existing count-change effect):
    location_count   number
    has_locations    "yes" | "no"

  Path B (rich trigger fire — preferred for new callsites):
    action           "add" | "remove"
    trigger          a value from SAVE_TRIGGERS
    location_state   normalized slug
    is_first_location boolean

Location Saved
  location_name
  location_type    "search" | "geolocation" | "alert"

Location Removed
  location_name

Location Viewed on Map
  location_name
```

### Affiliate events (gated)

```
Affiliate Click
  product     productId from src/data/affiliateProducts.js (e.g. "midland-er310")
  category    category id (e.g. "stay-informed")
  tier        "S" | "A" | "B" | "C"
  placement   typically "prep-page"

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
CHECK_LOCATION_BUTTON       "check_location_button"
YOUR_LOCATIONS_WIDGET       "your_locations_widget"
MAP_LOCATION_PIN_CLICK      "map_location_pin_click"
AUTO_GEOLOCATE              "auto_geolocate"
```

`STATE_PAGE_SAVE_BUTTON` is intentionally omitted — state pages have no save button today. Add the constant when the feature is built.

### MAP_REGION_SOURCES

```
HEATMAP                     "heatmap"
MOST_IMPACTED_LIST          "most_impacted_list"
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
- `src/data/affiliateProducts.js` — `productId` values used by Affiliate Click / Essentials Card Click events
- `src/config/featureFlags.js` — `AFFILIATE_LINKS_ENABLED` gating
