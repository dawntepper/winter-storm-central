# Location Analytics Audit

Audit of saved-location instrumentation on StormTracking.io. Locations are stored locally (`localStorage`, no accounts). This document maps every code path that mutates saved locations, every analytics event, and recommended Plausible dashboard views.

Last reviewed: 2026-06-08.

---

## Architecture summary

```
userLocations (homepage map pins)
├── searchLocations   ← ZipCodeSearch (localStorage: winterStorm_userLocations)
└── alertLocations    ← Live Alert "Add to Map" (localStorage: winterStorm_alertLocations)
```

`userLocations.length` drives the **Your Locations** widget and map markers. Intent events (`Location Added`, `Location Removed`, etc.) fire only from explicit user actions — not from page hydration or localStorage restore.

**High-level count** is tracked separately via `Location Count Changed` (fires on every `userLocations.length` change, including hydration).

---

## Events

### `Location Count Changed` (retained)

| Property | Type | Description |
|---|---|---|
| `location_count` | number | Total saved map pins after the change |
| `has_locations` | `"yes"` \| `"no"` | Whether count > 0 |

| Fires from | File | Notes |
|---|---|---|
| `useEffect` on `userLocations.length` | `src/App.jsx` | Includes hydration on mount/refresh |

**Use for:** aggregate funnel volume, % sessions with any saved location (`has_locations = yes`).

---

### `Location Added` (new)

| Property | Type | Description |
|---|---|---|
| `trigger` | `SAVE_TRIGGERS` value | How the user added the pin |
| `state` | string | Normalized state slug from location name (e.g. `co`) |
| `city` | string | Present when parseable from `"City, ST"` name |
| `is_first_location` | boolean | `true` when this add brings count from 0 → 1 |

| Fires from | Trigger | File / handler |
|---|---|---|
| Check Location → **Add to Map** checkbox (checked) | `check_location_button` | `ZipCodeSearch.handleToggleMap` |
| Live Alert card → **+ Add to Map** | `alert_add_to_map` | `App.handleAddAlertToMap` |

**Use for:** add volume by source, state distribution, search vs alert intent split.

---

### `Location Removed` (new schema)

| Property | Type | Description |
|---|---|---|
| `trigger` | `SAVE_TRIGGERS` value | How the user removed the pin |
| `state` | string | Normalized state slug |
| `city` | string | Present when parseable |
| `remaining_location_count` | number | Count after removal |

| Fires from | Trigger | File / handler |
|---|---|---|
| Check Location → **Add to Map** unchecked | `check_location_button` | `ZipCodeSearch.handleToggleMap` |
| Check Location → **×** dismiss (while on map) | `check_location_button` | `ZipCodeSearch.handleRemove` |
| Your Locations → **×** remove (search pin) | `your_locations_remove` | `App.handleRemoveSearchLocation` |
| Your Locations → **×** remove (alert pin) | `your_locations_remove` | `App.handleRemoveAlertLocation` |

**Use for:** churn by trigger, whether users prune after adding via search vs alerts.

---

### `First Location Added` (new)

| Property | Type | Description |
|---|---|---|
| `trigger` | `SAVE_TRIGGERS` value | First add trigger in the session |
| `state` | string | State of first saved pin |
| `city` | string | Present when parseable |

| Fires from | File | Notes |
|---|---|---|
| `trackLocationAdded()` when `previousCount === 0` | `src/utils/analytics.js` | **Once per browser session** (in-memory flag) |

**Use for:** activation rate — % of sessions where a user saves at least one location.

---

### `Multiple Locations Reached` (new)

| Property | Type | Description |
|---|---|---|
| `location_count` | `2` \| `3` \| `5` | Milestone crossed |

| Fires from | File | Notes |
|---|---|---|
| `trackLocationAdded()` when count crosses 2, 3, or 5 | `src/utils/analytics.js` | **Once per milestone per session**; not fired on hydration |

**Use for:** multi-location monitoring demand — key signal for family / Pro tier validation.

---

### Related events (unchanged, not location-count events)

| Event | What it tracks | Location save? |
|---|---|---|
| `Geolocation Used` | GPS button granted (`NearMeHeader`, `StormMap`) | **No** — centers map only |
| `Location Viewed on Map` | User clicked a saved pin name to re-center | **No** |
| `Alert Added to Map` | Legacy category signal on alert pin add | Fires alongside `Location Added` |
| `Location Saved` | Legacy event (`location_name`, `location_type`) | **Not wired** in production UI |

---

## SAVE_TRIGGERS reference

| Constant | Value | Wired? | Description |
|---|---|---|---|
| `CHECK_LOCATION_BUTTON` | `check_location_button` | ✅ | ZIP/city search → Add to Map toggle or dismiss |
| `YOUR_LOCATIONS_REMOVE` | `your_locations_remove` | ✅ | × button in Your Locations list |
| `ALERT_ADD_TO_MAP` | `alert_add_to_map` | ✅ | Live Alert card → Add to Map |
| `YOUR_LOCATIONS_WIDGET` | `your_locations_widget` | ⏳ Reserved | Future: in-widget toggle without search card |
| `MAP_LOCATION_PIN_CLICK` | `map_location_pin_click` | ⏳ Reserved | Future: save from map pin interaction |
| `AUTO_GEOLOCATE` | `auto_geolocate` | ⏳ Reserved | Future: auto-save on GPS (today GPS does not save) |

---

## Code path audit: every `userLocations` mutation

### Add paths

| # | User action | Storage | Analytics fired |
|---|---|---|---|
| 1 | ZIP search → check **Add to Map** | `winterStorm_userLocations` | `Location Added` (`check_location_button`), possibly `First Location Added`, `Multiple Locations Reached`; then `Location Count Changed` |
| 2 | City search → check **Add to Map** | same | same |
| 3 | Live Alert → **+ Add to Map** | `winterStorm_alertLocations` | `Location Added` (`alert_add_to_map`), `Alert Added to Map`, milestone events; then `Location Count Changed` |

### Remove paths

| # | User action | Storage | Analytics fired |
|---|---|---|---|
| 4 | Uncheck **Add to Map** on search card | `winterStorm_userLocations` | `Location Removed` (`check_location_button`); then `Location Count Changed` |
| 5 | **×** on search card while pin is on map | same | `Location Removed` (`check_location_button`) |
| 6 | **×** in Your Locations (search pin) | same + state sync | `Location Removed` (`your_locations_remove`) |
| 7 | **×** in Your Locations (alert pin) | `winterStorm_alertLocations` | `Location Removed` (`your_locations_remove`) |

### Non-mutating / no-save paths (documented for completeness)

| Action | Component | Effect |
|---|---|---|
| ZIP/city search without Add to Map | `ZipCodeSearch` | Shows preview card only; no pin |
| `?location=` URL param | `useLocationParam` → `ZipCodeSearch` | Auto-runs search; does **not** auto-add to map |
| **Find Weather Near Me** | `NearMeHeader` | `Geolocation Used` + map center; **no save** |
| **My Location** on map | `StormMap` | `Geolocation Used` + map center; **no save** |
| Click saved pin name | `App.handleViewedLocationClick` | `Location Viewed on Map`; **no count change** |
| Click search result city name | `App.handleSearchLocationClick` | `Location Viewed on Map`; **no count change** |
| Page load / refresh | `ZipCodeSearch` mount + `App` alert hydrate | Restores pins; **`Location Count Changed` only** (no intent events) |
| Re-search existing ZIP/city | `ZipCodeSearch.fetch*` | Updates weather data; preserves `onMap` flag |

### Storm / forecast pages

Storm event pages and `/forecast` use **empty** `userLocations={[]}` — they do not read or write homepage saved locations. `CityCards.onAddCity` exists on storm trackers but is not connected to homepage persistence.

---

## Suggested Plausible dashboard metrics

### Activation

| Metric | Query |
|---|---|
| Session activation rate | `First Location Added` / unique visitors |
| First-add by trigger | `First Location Added` grouped by `trigger` |
| Adds by source | `Location Added` grouped by `trigger` |

### Multi-location monitoring (Pro demand signal)

| Metric | Query |
|---|---|
| % sessions reaching 2+ pins | `Multiple Locations Reached` where `location_count = 2` / visitors |
| Power users (5 pins) | `Multiple Locations Reached` where `location_count = 5` |
| Avg pins per active user | `Location Count Changed` → average of `location_count` where `has_locations = yes` |

### Engagement quality

| Metric | Query |
|---|---|
| Search vs alert adds | `Location Added` filter `trigger = check_location_button` vs `alert_add_to_map` |
| Remove rate by trigger | `Location Removed` grouped by `trigger` |
| Net growth | `Location Added` count − `Location Removed` count (same period) |
| State concentration | `Location Added` grouped by `state` |

### Funnel (example)

```
Visit homepage
  → First Location Added          (activation)
  → Multiple Locations Reached = 2  (multi-monitor intent)
  → Multiple Locations Reached = 5  (power-user / family tier candidate)
```

---

## Future Pro validation metrics (recommended)

These events are **not implemented** yet. Add when the corresponding UI ships.

| Event | When to fire | Pro signal |
|---|---|---|
| `Email Signup Started` | User opens alert email signup form / modal | Monetization funnel entry |
| `Email Signup Completed` | Successful email alert subscription | Conversion |
| `Alert Viewed` | User opens alert detail (modal or expanded card) | Alert engagement depth |
| `Explain Alert Clicked` | User taps "What does this mean?" / educational CTA | Education → trust → upgrade |
| `Save Multiple Locations CTA Clicked` | User clicks upsell for multi-location save | Direct Pro demand |
| `Monitor Family Locations CTA Clicked` | User clicks family-monitoring CTA | Family tier demand |

### How they connect to location analytics

- **`Multiple Locations Reached`** is the passive signal — users already save 2–5 pins without an account.
- **`Save Multiple Locations CTA Clicked`** is the active signal — users hit a limit or see an upsell.
- Compare CTA clicks to organic `location_count = 5` events to size the addressable Pro audience.
- Pair **`First Location Added`** with **`Email Signup Completed`** to measure activation → retention.

### Suggested Pro readiness scorecard

| Signal | Healthy benchmark (hypothesis) |
|---|---|
| `First Location Added` / visitors | > 15% |
| Sessions with `location_count >= 2` | > 5% of activated users |
| `Location Added` with `trigger = alert_add_to_map` | Shows alert-driven engagement |
| `Monitor Family Locations CTA Clicked` / `Multiple Locations Reached (5)` | CTA interest vs organic power users |

---

## Implementation files

| File | Role |
|---|---|
| `src/utils/analytics.js` | `trackLocationAdded`, `trackLocationRemoved`, `trackLocationCountChanged`, `SAVE_TRIGGERS` |
| `src/App.jsx` | Count effect, alert add/remove, Your Locations remove |
| `src/components/ZipCodeSearch.jsx` | Search add/remove via Add to Map checkbox |
| `docs/analytics-reference.md` | Full event catalog (keep in sync) |

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-08 | Split intent events from `Location Count Changed`; added `Location Added`, `Location Removed` (new props), `First Location Added`, `Multiple Locations Reached`; removed `trackLocationChange` dual-fire pattern |
