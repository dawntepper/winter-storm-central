# Product analytics domains

StormTracking writes analytics to several Supabase tables. Each table has a distinct purpose; some events are intentionally duplicated across tables.

## Table ownership

| Table | Written by | Purpose |
|-------|------------|---------|
| `visitor_sessions` | `visitorSessionService.js` | New vs returning visitors (one row per browser tab session) |
| `product_events` | `productAnalyticsService.js` via `analytics.js` | Sequential user-journey funnel (homepage → state → search → county → radar → save) |
| `radar_events` | `productAnalyticsService.js` via `analytics.js` | Radar engagement (opens, toggles, type/location changes) |
| `location_search_events` | `locationCatalogService.js` (`trackLocationSearch`) | Location search performance — every catalog lookup (success + failure) |
| `county_alert_views` | `locationCatalogService.js` (`trackCountyAlertView`) | County alert page / result views with alert counts |
| `user_locations` | `locationsRepo.js` | Signed-in saved locations only |

## Intentional duplicates

| User action | `product_events` | Domain table |
|-------------|------------------|--------------|
| Successful location search (ZIP/city/county/GPS/saved) | `location_search_success` | `location_search_events` (`success = true`) |
| Failed location search | — (Plausible only) | `location_search_events` (`success = false`, `resolved_type = 'not_found'`) |
| County alert viewed (search result, county page land) | `county_alert_view` | `county_alert_views` |

`product_events` uses session-scoped dedupe (cooldown / debounce). Domain tables follow the same dedupe gate for paired writes (e.g. `county_alert_views` only inserts when `county_alert_view` product event is emitted).

Domain tables carry richer columns (`resolved_*`, `source_page`, `alert_count`) that `product_events.metadata` does not replace for admin aggregations.

## Admin dashboard → data source

| Card | Source | Notes |
|------|--------|-------|
| Returning Visitors | `visitor_sessions` / `admin_returning_visitor_stats` | Filter: `created_at` |
| Missing Location Searches | `missing_location_searches` view (all time) or `location_search_events` where `success = false` (date range) | Grouped by query + state |
| Location Search Performance | `location_search_events` / `admin_location_search_stats` | Totals + top successful / failed queries |
| Location Sources | `location_search_events` (`success = true`, bucketed by `resolved_type`) | gps, city, county, zip, saved_location |
| County Alert Views | `county_alert_views` (+ `counties` join) | Filter: `created_at` |
| Radar Engagement | `radar_events` / `admin_radar_engagement_stats` | Opens, types, location changes |
| User Journeys | `product_events` / `admin_product_funnel_stats`, `admin_top_journey_paths` | Funnel steps are product event names only |
| Storm Events | `product_events` (storm_* events) + `visitor_sessions` landing `/storm/*` | Admin `/admin/analysis` Storm Events section |
| Saved Locations | `user_locations` / `admin_saved_location_stats` | Signed-in users only |

## Entry points → `location_search_events`

| Entry point | Component | `source_page` / context |
|-------------|-----------|-------------------------|
| Homepage Check Location (ZIP/city/GPS) | `ZipCodeSearch`, `NearMeHeader` | `homepage-hero` |
| Radar Check Location | `ZipCodeSearch`, `NearMeHeader` | `radar-hero` |
| State “Check Alerts Near You” | `CheckAlertsNearYou` | state slug |
| Saved location tap on map | `App.jsx` | `homepage-saved-locations` |

Columns: `visitor_id`, `user_id` (if signed in), `query`, `source_page`, `state_code`, `resolved_type`, `resolved_city_id`, `resolved_county_id`, `resolved_zip`, `success`, `created_at`.

## Entry points → `county_alert_views`

| Trigger | Component | `source_page` |
|---------|-----------|---------------|
| State-page search resolves to county | `CheckAlertsNearYou` | `state-page-search` |
| County alert page land | `CountyAlertsPage`, `CatalogCityAlertsPage` | `county-page` |

Columns: `visitor_id`, `user_id` (if signed in), `county_id`, `state_code`, `alert_count`, `source_page`, `created_at`.

## SQL verification

```sql
-- Compare location search funnel vs domain table (last 7 days)
select
  (select count(*) from product_events
   where event_name = 'location_search_success'
     and created_at >= now() - interval '7 days') as product_success,
  (select count(*) from location_search_events
   where success = true
     and created_at >= now() - interval '7 days') as domain_success;

-- Compare county views funnel vs domain table (last 7 days)
select
  (select count(*) from product_events
   where event_name = 'county_alert_view'
     and created_at >= now() - interval '7 days') as product_county_views,
  (select count(*) from county_alert_views
   where created_at >= now() - interval '7 days') as domain_county_views;

-- Top missing searches
select * from missing_location_searches limit 20;

-- Recent county alert view inserts
select cav.*, c.name as county_name
from county_alert_views cav
join counties c on c.id = cav.county_id
order by cav.created_at desc
limit 20;

-- Location search by resolved type (last 7 days)
select resolved_type, count(*) as n
from location_search_events
where success = true
  and created_at >= now() - interval '7 days'
group by resolved_type
order by n desc;
```
