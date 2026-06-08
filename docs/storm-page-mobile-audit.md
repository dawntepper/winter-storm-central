# Storm Page Mobile Audit

Audit date: June 2026. Scope: `StormEventPage.jsx` and related components for viewports 320–414px.

## Issues found

| Issue | Severity | Location |
|-------|----------|----------|
| Mobile stacking: alerts appeared **above** map | High | `StormEventPage.jsx` mobile layout |
| Impacts / storm details only on desktop | High | Right column not mirrored on mobile |
| Nested `<button>` inside collapse toggle (invalid HTML, a11y) | Medium | `MobileAlertsCard` |
| Horizontal overflow risk from map / wide content | Medium | Page root, map wrapper |
| Refresh / share tap targets &lt; 44px | Medium | Alerts refresh, header share |
| Raw URLs could appear in emergency links | Low | N/A until panel — addressed in `EmergencyInfoPanel` |
| Emergency panel loaded even when disabled | Low | No lazy gate |

## Files changed

| File | Changes |
|------|---------|
| `src/components/StormEventPage.jsx` | Mobile order, overflow guards, shared `StormImpactsSection` / `ActiveAlertsPanel`, lazy emergency panel, tap targets |
| `src/components/EmergencyInfoPanel.jsx` | New — mobile-friendly links, 44px tap targets, semantic markup |
| `src/components/MobileAlertsCard` (in StormEventPage) | Fixed nested buttons, `aria-expanded`, 44px refresh |
| `src/services/stormEventsService.js` | Emergency fields normalization |
| `src/content/storms/noreaster-january-2026.json` | Test fixture with panel enabled |

## Before / after

### Mobile stacking (panel enabled)

**Before**

1. Title / status (header)
2. Risk summary (header card)
3. **Active alerts** ← wrong order
4. Map
5. *(impacts missing on mobile)*

**After**

1. Storm title / status
2. Current risk summary
3. Radar / map
4. Active warnings
5. Emergency Information Panel (if enabled)
6. Storm details (impacts)
7. Preparedness links
8. Historical sections (completed events)

### Desktop (panel disabled)

Unchanged: 60/40 map | alerts+impacts grid.

### Desktop (panel enabled)

70% main (map + alerts row, impacts below) | 30% sticky emergency sidebar.

## Stacking behavior summary

- Header blocks (title, overview card) remain above `<main>` on all breakpoints.
- `overflow-x-hidden` on page root; `min-w-0` + `max-w-full overflow-hidden` on map containers.
- `EmergencyInfoPanel` only loaded via `React.lazy` when `showEmergencyInfoPanel` is true.

## Remaining risks

| Risk | Notes |
|------|-------|
| Leaflet map height on very small screens | Hero map uses fixed heights (500px mobile); may feel tall on 320px — acceptable for radar UX |
| Long state button row in overview card | Wraps with `flex-wrap`; rare horizontal scroll if many states + badges |
| `EssentialsCard` affiliate section | Gated by feature flag; not audited in depth here |
| Completed + panel enabled | Panel shows in 70/30 grid on large screens; single column on mobile |

## Testing checklist

### Panel disabled

- [ ] `/storm/winter-storm-fern` — layout matches pre-change behavior
- [ ] No emergency panel markup in DOM
- [ ] No `Emergency Info Panel Viewed` analytics event

### Panel enabled — entry counts

- [ ] `/storm/noreaster-january-2026` — summary + 4 active entries (1 resolved hidden)
- [ ] Toggle off in JSON → panel absent after rebuild
- [ ] Admin: 0 entries → empty state message
- [ ] Admin: 1 entry → renders correctly
- [ ] Admin: 10+ entries → scrollable panel, no horizontal overflow

### Content edge cases

- [ ] Long entry title / description wraps (no overflow)
- [ ] Long `source_name` displays; URL not shown raw
- [ ] Official badge visible when `is_official: true`
- [ ] Source + social links open in new tab; analytics fire

### Mobile viewports (320, 375, 414px)

- [ ] No horizontal page scroll
- [ ] Map contained in viewport width
- [ ] Alert collapse + refresh buttons tappable (≥44px)
- [ ] Emergency link rows tappable
- [ ] Correct section order: map → alerts → panel → impacts

### Accessibility

- [ ] Heading hierarchy: page `h1`, panel `h2`, entry `h3`
- [ ] External links have accessible names + sr-only “opens in new tab”
- [ ] Alert collapse has `aria-expanded`

### Analytics (dev console)

- [ ] `Emergency Info Panel Viewed` once per page load
- [ ] `Emergency Info Link Clicked` on source/social clicks
