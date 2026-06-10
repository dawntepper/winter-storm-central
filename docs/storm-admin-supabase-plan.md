# Storm Admin Supabase Plan

Reconnect storm admin to Supabase so storms can be created, previewed, launched, and updated from `/admin/storms` without the manual JSON download → commit → push loop. JSON storms and prerendered SEO pages remain supported.

## Schema

Migration: `supabase/migrations/003_storms_admin.sql`

| Table | Purpose |
|-------|---------|
| `storm_admins` | Email allowlist for authenticated Supabase admin access |
| `storms` | Core storm record (admin workflow status + SEO fields + `content` jsonb) |
| `storm_emergency_summary` | One summary block per storm (`items` jsonb array) |
| `storm_emergency_info` | Curated emergency entries (sortable, linkable) |

### `storms.status` (admin workflow)

| Value | Meaning |
|-------|---------|
| `draft` | Work in progress, not public |
| `preview` | Accessible via preview URL or admin session |
| `live` | Public (RLS allows anon read); triggers SEO prerender on publish |
| `archived` | Hidden from public; maps to `completed` on the page |

Public page status (`active`, `forecasted`, `completed`) is stored in `storms.content.public_status` and resolved in `src/lib/stormNormalize.js`.

### RLS

- **Public read:** `storms`, `storm_emergency_summary`, `storm_emergency_info` when parent storm `status = 'live'`
- **Admin read/write:** authenticated users whose email is in `storm_admins`
- **Admin API writes:** `netlify/functions/storm-admin-api.js` uses service role (bypasses RLS)

### Preview RPC

`get_storm_preview_by_token(slug, token)` — SECURITY DEFINER function for draft/preview access without exposing all drafts.

## Workflows

### Supabase workflow (new)

1. Open `/admin/storms` (password gate unchanged)
2. Create or edit a storm
3. **Save Draft (DB)** — `status = draft`
4. **Save & Preview** — `status = preview`; open `/storm/preview/:slug?token=…`
5. **Launch / Publish** — `status = live`, `published_at` set, Netlify build hook fired
6. **Archive** from list — `status = archived`, build hook fired

Emergency summary + entries are saved with the storm (replaced on each save).

### JSON workflow (legacy, kept)

1. **Download JSON** from the form
2. Save to `src/content/storms/[slug].json`
3. Commit and push
4. Netlify build runs `scripts/generate-storm-pages.js`

### Public page loader

`src/services/stormEventsService.js`:

1. Live Supabase storm (overrides JSON on slug collision)
2. Preview token or admin session (preview route only)
3. Static JSON fallback (`/storm/:slug` unchanged for JSON storms)

Emergency Info right rail uses existing `EmergencyInfoPanel` — data comes from DB join or JSON `emergency_*` fields.

## Build hook & SEO prerender

On **publish** or **archive**, the admin API POSTs to `NETLIFY_BUILD_HOOK_URL`.

`scripts/generate-storm-pages.js` at build time:

1. Loads JSON from `src/content/storms/`
2. Fetches **live** storms from Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
3. Merges by slug (DB wins)
4. Writes `dist/storm/[slug]/index.html` and `dist/storm-data.json`

Client-side runtime also reads live DB storms for emergency info updates between builds.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Client | Public storm reads + preview RPC |
| `VITE_SUPABASE_ANON_KEY` | Client | Public storm reads |
| `VITE_ADMIN_PASSWORD` | Client | Admin UI gate + API password |
| `ADMIN_PASSWORD` | Netlify function | Server-side API validation |
| `SUPABASE_URL` | Netlify (build + functions) | Service role access |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify (build + functions) | Admin API + prerender fetch |
| `VITE_NETLIFY_BUILD_HOOK_URL` | Client (optional) | Client-side hook trigger fallback |
| `NETLIFY_BUILD_HOOK_URL` | Netlify function | Publish/archive rebuild |

## Setup checklist

1. Run migration `003_storms_admin.sql` in Supabase SQL editor or `supabase db push`
2. Insert admin email(s): `insert into storm_admins (email) values ('you@example.com');`
3. Set env vars in Netlify and local `.env`
4. Create a Netlify build hook and set `NETLIFY_BUILD_HOOK_URL`
5. Verify `/admin/storms` → Save Draft → Preview URL → Launch

## JSON migration notes

- Existing JSON storms continue to work at `/storm/:slug` with no login
- To move a JSON storm to DB: Import JSON in admin → Save Draft → Preview → Launch
- After launch, DB row overrides JSON for the same slug on the live site
- Optional: keep JSON file for static prerender backup until DB publish is verified
- Do **not** delete JSON files until the DB storm is live and prerender confirmed

## Analytics (Plausible)

| Event | When |
|-------|------|
| `Storm Previewed` | Admin saves preview |
| `Storm Published` | Admin launches storm |
| `Emergency Info Added` | Emergency entries saved with storm |
| `Emergency Info Link Clicked` | Public panel link click (unchanged) |

## Files

| Path | Role |
|------|------|
| `supabase/migrations/003_storms_admin.sql` | Schema + RLS + preview RPC |
| `src/lib/stormNormalize.js` | JSON/DB → camelCase event shape |
| `src/lib/stormsRepo.js` | Supabase reads + admin API client |
| `src/services/stormEventsService.js` | Public loader (DB + JSON) |
| `netlify/functions/storm-admin-api.js` | Password-gated CRUD |
| `src/components/AdminStorms.jsx` | Dual JSON + DB workflow UI |
| `src/components/StormEventPage.jsx` | Preview banner + DB loader |
| `scripts/generate-storm-pages.js` | Prerender JSON + live DB storms |

## What's stubbed / requires infra

- Migration must be applied manually (not deployed by this change)
- Admin API requires Netlify dev or production (`netlify dev` for local function calls)
- Build hook only fires when `NETLIFY_BUILD_HOOK_URL` is set
- `storm_admins` email RLS is for future Supabase-auth admin UI; current admin uses password + service-role API
