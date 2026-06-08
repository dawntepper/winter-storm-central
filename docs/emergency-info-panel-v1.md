# Emergency Information Panel v1

Manually curated emergency updates on storm event pages — answers **"What do I do now?"** without social feeds or automated ingestion.

## Architecture

```
src/content/storms/[slug].json     ← source of truth (static files today)
        ↓
stormEventsService.js (normalize)  ← snake_case JSON → camelCase app model
        ↓
StormEventPage.jsx                 ← layout + conditional lazy load
        ↓
EmergencyInfoPanel.jsx             ← public UI + analytics
        ↓
AdminStorms.jsx                    ← manual curation + JSON export
```

- **Feature flag:** `show_emergency_info_panel` (default `false`). When `false`, the storm page is unchanged and the panel component is never loaded.
- **Lazy loading:** `EmergencyInfoPanel` is `React.lazy()`-imported only when the flag is `true`.

## Data model

Stored in storm JSON using **snake_case** (consistent with existing storm files). Normalized to **camelCase** in `stormEventsService.js` for React components.

| JSON field | App field | Type | Notes |
|------------|-----------|------|-------|
| `show_emergency_info_panel` | `showEmergencyInfoPanel` | boolean | Default `false` |
| `emergency_summary` | `emergencySummary` | object \| null | Top summary card |
| `emergency_summary.title` | `title` | string | e.g. "Emergency Status" |
| `emergency_summary.items` | `items` | string[] | Bullet lines (emoji OK) |
| `emergency_summary.updated_at` | `updatedAt` | ISO8601 | |
| `emergency_entries` | `emergencyEntries` | array | Curated entries |

### Entry shape

| JSON field | App field | Type |
|------------|-----------|------|
| `id` | `id` | string (uuid or slug) |
| `title` | `title` | string |
| `category` | `category` | enum (see below) |
| `location` | `location` | string |
| `description` | `description` | string |
| `source_name` | `sourceName` | string — **displayed** to users |
| `source_url` | `sourceUrl` | string |
| `social_url` | `socialUrl` | string (optional) |
| `is_official` | `isOfficial` | boolean |
| `status` | `status` | `active` \| `resolved` \| `archived` |
| `created_at` | `createdAt` | ISO8601 |
| `updated_at` | `updatedAt` | ISO8601 |
| `expires_at` | `expiresAt` | ISO8601 \| null |
| `storm_slug` | `stormSlug` | string |

**Categories:** Official Updates, Shelters, Water, Ice, Roads, Power, Fuel, Medical, Evacuation, School Closures, Community Updates, Other

## Live page behavior

- Entries sorted **newest first** by `updatedAt` (fallback `createdAt`).
- **Only `status: active` entries** are shown on the public page. `resolved` and `archived` entries are **hidden** (not de-emphasized) to keep the panel actionable. Historical data remains in JSON for admin and future DB use.
- Links show `source_name` text — raw URLs are never displayed.

## Layout

### Desktop (panel enabled)

| Main content (70%) | Emergency panel (30%) |
|--------------------|------------------------|
| Map + alerts row, then impacts, back link | Sticky sidebar |

### Mobile (panel enabled)

1. Storm title / status (header)
2. Risk summary (overview card in header)
3. Radar / map
4. Active warnings (collapsible alerts)
5. Emergency Information Panel
6. Storm details (impacts)
7. Preparedness links (`EssentialsCard`)
8. Historical sections (completed events)

## Admin workflow

1. Open `/admin/storms` and edit a storm (or create new).
2. Toggle **Show Emergency Information Panel**.
3. Edit **Emergency Summary** (title + bullet items).
4. Add / edit / remove / reorder **Emergency Entries** (manual only — no API feeds).
5. Click **Update Storm** → downloads `[slug].json`.
6. Save to `src/content/storms/`, commit, push.

When a storm ends: set `show_emergency_info_panel` to `false` but **keep all entry data** in JSON. Never delete historical entries.

## Analytics (Plausible)

| Event | Props |
|-------|-------|
| `Emergency Info Panel Viewed` | `storm_slug`, `storm_type`, `entry_count` |
| `Emergency Info Link Clicked` | `storm_slug`, `storm_type`, `category`, `source_name`, `is_official`, `link_type` (`source` \| `social`) |

Implemented in `src/utils/analytics.js`, wired in `EmergencyInfoPanel.jsx`.

## Database migration notes

Future Supabase (or similar) tables can mirror this schema 1:1:

```sql
-- storms table: add column
show_emergency_info_panel BOOLEAN NOT NULL DEFAULT FALSE

-- emergency_summaries (1:1 with storm)
storm_slug, title, items JSONB, updated_at TIMESTAMPTZ

-- emergency_entries (1:many)
id UUID PK, storm_slug FK, title, category, location, description,
source_name, source_url, social_url, is_official, status,
created_at, updated_at, expires_at
```

Migration path:

1. Import existing JSON `emergency_entries` arrays into `emergency_entries` table.
2. Keep `stormEventsService` as a thin client that reads from API instead of glob — normalization layer unchanged.
3. Admin UI can later POST/PATCH instead of JSON download.

## Archive strategy

| Action | Behavior |
|--------|----------|
| Entry resolved | Set `status: resolved` — hidden on live page, kept in JSON/DB |
| Entry archived | Set `status: archived` — hidden on live page, kept in JSON/DB |
| Storm ends | Toggle `show_emergency_info_panel: false`; data preserved |
| Never | Delete historical entries |

## Local testing

Example data: `src/content/storms/noreaster-january-2026.json` (`show_emergency_info_panel: true`, `status: forecasted`).

Visit: `/storm/noreaster-january-2026`
