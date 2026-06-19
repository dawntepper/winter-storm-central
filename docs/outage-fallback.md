# StormTracking.io — Outage Response & Alerting

Quick reference when **stormtracking.io** is unreachable, misbehaving, or serving bad redirects. Covers **how you get notified**, **what Netlify does and does not watch**, and **how to stand up a static fallback** while the main app is fixed.

> **Status of fallback assets:** `public/fallback.html` and `public/503.html` are planned but not yet in the repo. Until they land, use the standalone HTML from this doc’s [Fallback deployment](#fallback-deployment) section or deploy any minimal static “we’ll be back” page.

---

## Alerting

**Netlify alone is not enough.** Deploy-failure alerts only fire when a build fails. A **successful deploy with a broken redirect rule** (like the recent infinite 301 loop) leaves the site “up” from Netlify’s perspective while users see a blank page or browser error. You need an **external uptime monitor** that checks the live URL.

### What Netlify covers

| Signal | Notified? | How |
|--------|-----------|-----|
| **Deploy failed** (build error) | Yes | Email (Pro+), Slack, HTTP webhook, GitHub commit status |
| **Deploy succeeded** | Optional | Same channels — useful for CI visibility, not outage detection |
| **Previously successful deploy failed** | Yes | Rare edge case (deploy later invalidated) |
| **Builds stopped / resumed** | Yes | Email to all site members |
| **Usage limits** (bandwidth, build minutes) | Yes | Billing email at 50% / 75% / 90% |
| **Form submissions** | Yes | Email, Slack, webhook |
| **Live site down / 5xx / redirect loop** | **No** | Not monitored proactively |
| **Post-deploy “does the site actually work?”** | **No** | Use external monitor or third-party post-deploy check |

### What Netlify Observability is (and isn’t)

**Observability** (`Project → Observability` in the Netlify UI) shows server-side request logs, status-code breakdowns, function errors, and bandwidth — useful **after** you know something is wrong. It does **not** page you when `/radar` starts 301-looping. Think of it as a dashboard, not an on-call system.

Also subscribe to **[status.netlify.com](https://www.netlifystatus.com/)** (email/RSS) for platform-wide incidents — distinct from your site’s config bugs.

---

## Recommended stack (~10 minutes)

Three layers, cheapest-first:

1. **Netlify — deploy failure alerts** (catches broken builds before they ship, or when build fails)
2. **UptimeRobot (free) — HTTP + keyword monitors** (catches live outages, redirect loops, wrong page on 200)
3. **Optional — GitHub Actions scheduled curl** (backup if you want alerts in-repo; see [Optional GitHub health check](#optional-github-health-check))

### Layer 1 — Netlify deploy failure alerts

#### Option A: Slack (recommended, all plans)

1. Open **[app.netlify.com](https://app.netlify.com)** → select your team.
2. **Team settings** → **Notifications** → **Slack notifications**.
3. Connect your Slack workspace (team Owner required).
4. **Add subscription** → event: **Deploy state changes**.
5. Filter: **Production** (and **Deploy Previews** if you want) → states: **Failed** only (skip Succeeded to reduce noise).
6. Pick channel (e.g. `#stormtracking-alerts`).

Per-site override: **Site configuration** → **Notifications** → subscribe a channel to deploy events for that site only.

Docs: [Netlify App for Slack](https://docs.netlify.com/extend/install-and-use/setup-guides/netlify-app-for-slack/)

#### Option B: HTTP webhook (Slack incoming webhook, PagerDuty, etc.)

1. **Site configuration** → **Notifications** → **Deploy notifications** → **Add notification**.
2. Type: **HTTP POST request** (outgoing webhook).
3. Event: **Deploy failed** (add a second notification for **Previously successful deploy failed** if desired).
4. URL: your endpoint (e.g. Slack Incoming Webhook URL).
5. Optional: set a **JWS secret** and verify `X-Webhook-Signature` on your receiver.

Create one notification per event type.

Docs: [Deploy notifications](https://docs.netlify.com/deploy/deploy-notifications/)

#### Option C: Email

**Project configuration** → **Notifications** → **Deploy notifications** → **Email**.

> Email deploy notifications require a **Pro or Enterprise** plan. Free teams should use Slack or webhooks.

#### Already on by default (GitHub-connected sites)

- **GitHub commit status** on failed/successful deploys — visible on commits and PRs without extra setup.
- Configure at **Project configuration** → **Notifications** → **Deploy notifications**.

---

### Layer 2 — UptimeRobot (external uptime)

Free tier: **50 monitors**, **5-minute** interval, email alerts, keyword monitoring.

#### Monitor 1 — Homepage HTTP

| Field | Value |
|-------|-------|
| Type | HTTP(s) |
| URL | `https://stormtracking.io/` |
| Interval | 5 minutes |
| Friendly name | `stormtracking.io — homepage` |

**Advanced settings:**

- Request timeout: **30s** (redirect loops often time out)
- Follow redirections: **enabled** (normal http→https is fine)
- Alert when down after: **2 consecutive failures** (if available)

#### Monitor 2 — Radar (primary user path)

| Field | Value |
|-------|-------|
| Type | HTTP(s) |
| URL | `https://stormtracking.io/radar` |
| Interval | 5 minutes |
| Friendly name | `stormtracking.io — radar` |

Same advanced settings as Monitor 1.

#### Monitor 3 — Keyword “is it really working?” (catches 200 with wrong body)

| Field | Value |
|-------|-------|
| Type | Keyword |
| URL | `https://stormtracking.io/radar` |
| Keyword | `StormTracking` (must appear in HTML) |
| Keyword type | Exists |
| Interval | 5 minutes |

This catches “200 OK but empty/error shell” and some mis-deploys. Avoid generic words like “Home” or “Loading”.

#### Monitor 4 (optional) — Redirect-loop detector

For the outage class that broke production (infinite 301s on `/radar`):

1. Duplicate the `/radar` HTTP monitor.
2. **Advanced** → uncheck **Follow redirections**.
3. **Custom HTTP statuses** → mark **301**, **302**, **307**, **308** as **Down**.

A healthy SPA rewrite returns **200** on `/radar` with no redirect chain. Unexpected 3xx on that URL opens an incident.

> **Note:** Netlify SPA `/* → /index.html` should return 200, not 301. Any 3xx on `/radar` is suspicious.

#### UptimeRobot setup steps

1. Sign up at **[uptimerobot.com](https://uptimerobot.com)**.
2. **Add New Monitor** for each row above.
3. **My Settings** → **Alert Contacts** → add your email (and SMS on paid tier).
4. Attach alert contacts to each monitor.
5. Optional: **Integrations** → Slack (paid) or use email → Gmail filter → forward to phone.

#### Other free alternatives

| Service | Free tier | Notes |
|---------|-----------|-------|
| [Better Stack Uptime](https://betterstack.com/uptime) | 10 monitors, 3 min | Slack on free tier |
| [Freshping](https://www.freshworks.com/website-monitoring/) | 50 checks, 1 min | Aggressive interval |
| [HetrixTools](https://hetrixtools.com) | 15 monitors, 1 min | Uptime + blacklist |

Any of these should watch `https://stormtracking.io/radar` with **non-200 = down** and, if possible, **keyword or content check**.

---

### Recommended alert contacts

| Role | Channel | Why |
|------|---------|-----|
| Primary on-call | Personal email + phone (SMS via carrier gateway or UptimeRobot SMS) | Fastest for overnight |
| Team visibility | Slack `#stormtracking-alerts` | Netlify deploy failures + optional UptimeRobot integration |
| Platform | status.netlify.com RSS/email | Distinguish “our bug” vs “Netlify down” |

Use **two independent paths** (e.g. Netlify → Slack, UptimeRobot → email/SMS) so one integration failure doesn’t leave you blind.

---

### When an alert fires — what to do

1. **Confirm scope** — check homepage, `/radar`, and `/alerts` in a private window. Compare with [status.netlify.com](https://www.netlifystatus.com/).
2. **If deploy just failed** — open Netlify **Deploys** → failed deploy log → fix build → redeploy.
3. **If deploy succeeded but site is broken** (redirect loop, blank page):
   - Check **Project configuration** → **Redirects** and repo `public/_redirects` / `netlify.toml` for conflicting rules.
   - **Rollback**: Netlify **Deploys** → last known-good deploy → **Publish deploy**.
   - See commit `e05d7ea` area: `pretty_urls = false` in `netlify.toml` prevents trailing-slash redirect fights.
4. **If rollback isn’t enough** — activate static fallback (below) so users see a helpful page instead of a browser error.
5. **Before closing the incident** — confirm UptimeRobot monitors are green, spot-check mobile, then post a one-line note in Slack.

---

### Optional GitHub health check

A scheduled workflow can curl `/radar` and fail the Action (email from GitHub). Useful as a **tertiary** check; UptimeRobot is simpler for on-call.

We intentionally **did not** add `.github/workflows/uptime-check.yml` — external monitoring avoids GitHub notification noise and works even when Actions are disabled. Add a workflow later if you want in-repo audit trail.

Example check (for reference only):

```bash
curl -sfL --max-redirs 5 -o /dev/null -w "%{http_code}" https://stormtracking.io/radar | grep -q 200
```

---

## Fallback deployment

Use when the main Netlify app is broken and rollback isn’t immediate — redirect loops, bad deploy, or DNS issues.

### Static page (planned)

When merged, `public/fallback.html` will be a self-contained dark-themed page with:

- “StormTracking is temporarily unavailable”
- Links: [alerts.weather.gov](https://alerts.weather.gov/), [weather.gov](https://www.weather.gov/), [rainviewer.com](https://www.rainviewer.com/)
- Retry link to `https://stormtracking.io`

`public/503.html` will be served by Netlify for platform-level 503 responses.

### Stand up fallback in ~15 minutes (no main site required)

**Option A — Second Netlify site (simplest)**

1. Create a new site: **Add new site** → **Deploy manually** (drag-and-drop `fallback.html`).
2. Note URL: e.g. `stormtracking-status.netlify.app`.
3. Optional custom domain: `status.stormtracking.io` → CNAME to Netlify subdomain.
4. During outage: temporarily point `stormtracking.io` DNS to this site **or** share the status URL on social/email.

**Option B — GitHub Pages**

1. New repo `stormtracking-status` with `index.html` (copy of fallback).
2. **Settings** → **Pages** → deploy from `main` / root.
3. Custom domain `status.stormtracking.io` if desired.

**Option C — DNS swap (last resort)**

Only if you control DNS and need the apex domain on fallback:

- Point `stormtracking.io` A/CNAME to fallback host.
- **Document the previous Netlify DNS values** before changing.
- Revert DNS only after monitors are green for 30+ minutes.

### Verify primary site is back

1. UptimeRobot (or equivalent) all green on `/` and `/radar`.
2. Manual: homepage loads, radar map renders, `/alerts` loads.
3. `curl -sI https://stormtracking.io/radar` → `200`, `num_redirects: 0`.
4. Revert DNS if you pointed the apex at fallback.

---

## Quick checklist (printable)

- [ ] Netlify Slack or webhook: **Deploy failed** → `#stormtracking-alerts`
- [ ] UptimeRobot: `https://stormtracking.io/` HTTP monitor
- [ ] UptimeRobot: `https://stormtracking.io/radar` HTTP monitor
- [ ] UptimeRobot: `/radar` keyword monitor (`StormTracking`)
- [ ] Optional: `/radar` redirect detector (don’t follow redirects, 3xx = down)
- [ ] Subscribe to status.netlify.com
- [ ] Know last-good deploy in Netlify (one-click rollback)
- [ ] Fallback HTML hosted at second Netlify site or GitHub Pages (when ready)

---

## Related files

| File | Purpose |
|------|---------|
| `netlify.toml` | Build, redirects, `pretty_urls` |
| `public/_redirects` | SPA catch-all and API routes |
| `public/fallback.html` | *(planned)* static outage page |
| `public/503.html` | *(planned)* Netlify platform 503 page |
