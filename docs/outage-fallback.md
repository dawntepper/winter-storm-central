# Outage fallback plan

When stormtracking.io is unreachable (redirect loop, bad deploy, DNS issue, Netlify platform outage), users should land on a static page that explains the site is temporarily down — not gone forever.

Static pages live in `public/` and ship with every production build:

| File | URL | Purpose |
|------|-----|---------|
| `fallback.html` | `/fallback.html` | Canonical emergency page; deploy alone to GitHub Pages or a backup Netlify site |
| `503.html` | `/503.html` | Same message; used for Netlify maintenance mode and platform-level 503 responses |

Both files are self-contained (inline CSS, no JS). Vite copies `public/` to `dist/` automatically.

---

## When to activate

- **Redirect loop** — browser shows "too many redirects" (recent example: trailing-slash vs SPA canonical URLs)
- **Bad deploy** — blank page, build failure, or broken routing after a merge
- **DNS / SSL issue** — domain doesn't resolve or certificate errors on primary host
- **Planned maintenance** — you need to take the main site offline briefly
- **Netlify platform outage** — Netlify may serve `503.html` from your publish directory when the origin is unavailable

For redirect loops and DNS failures, `/fallback.html` on the **primary** site won't help — users never reach it. Use a **separate host** or DNS failover (below).

---

## Option A: Second Netlify site (recommended)

Keep a tiny backup site that only serves the fallback page.

### One-time setup

1. In Netlify, create a new site (e.g. `stormtracking-status.netlify.app`).
2. Connect the same repo **or** use manual deploy.
3. If using the repo:
   - **Build command:** `cp public/fallback.html dist/index.html && cp public/fallback.html dist/fallback.html`
   - **Publish directory:** `dist` (or publish `public/` directly with build command `echo ok`)
   - Simpler alternative: set publish directory to `public/` and add `public/index.html` as a copy of `fallback.html` on a `status` branch only.
4. Easiest path: create a **`status` branch** with only:
   ```
   index.html          ← copy of public/fallback.html
   favicon.ico         ← optional
   ```
5. Enable branch deploys for `status` and note the URL (`stormtracking-status.netlify.app`).

### During an outage

1. Confirm primary site is broken (`curl -I https://stormtracking.io`, check browser).
2. Point **`status.stormtracking.io`** CNAME to the backup Netlify site (see DNS below), **or** share the `.netlify.app` URL directly.
3. Post the status URL on social / update bio if needed.

### After recovery

1. Verify primary: `curl -I https://stormtracking.io` → `200`, homepage loads, `/radar` works.
2. Remove or repoint the `status.stormtracking.io` CNAME if you changed DNS.
3. Document what broke and whether `503.html` / maintenance redirect was enabled.

---

## Option B: GitHub Pages

Good free backup with no tie to Netlify.

### One-time setup

1. Create a **public** repo (e.g. `stormtracking-status`) or use GitHub Pages on a `gh-pages` branch in this repo.
2. Copy `public/fallback.html` to the repo root as **`index.html`**.
3. Enable GitHub Pages: Settings → Pages → deploy from `main` / root.
4. Site will be at `https://<user>.github.io/stormtracking-status/` (or custom domain).

### Custom domain

Add `status.stormtracking.io` as custom domain in GitHub Pages settings; create DNS CNAME:

```
status.stormtracking.io  CNAME  <user>.github.io
```

---

## DNS: status.stormtracking.io

Use a **subdomain** so the main apex/root record stays on Netlify.

| Record | Type | Value |
|--------|------|-------|
| `status.stormtracking.io` | CNAME | Backup host (Netlify subdomain or GitHub Pages) |

During a full primary outage, optionally:

- Tweet/post the status URL
- Temporarily point **`www`** to backup only if apex is broken (avoid unless necessary — affects SEO and email)

Do **not** change apex DNS unless you understand TTL and recovery steps.

---

## Netlify: on-site fallback (partial outages)

These work when Netlify still serves static files but the SPA or redirects are broken.

### Always available URLs

After deploy, verify:

```bash
curl -I https://stormtracking.io/fallback.html   # expect 200
curl -I https://stormtracking.io/503.html        # expect 200
```

Static files are served **before** the SPA catch-all (`/* → /index.html`).

### Maintenance mode (whole site)

Uncomment the block in `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/503.html"
  status = 503
  force = true
```

Deploy, then **re-comment and redeploy** when done. This returns HTTP 503 for all routes with the custom page body.

> **Note:** Netlify's automatic `503.html` handling (similar to `404.html`) applies when the platform cannot reach your deploy. A committed `503.html` ensures the message matches your branding if Netlify serves it during platform incidents. Manual maintenance mode uses the redirect above.

### Netlify branch / manual deploy

From [Netlify's maintenance guide](https://answers.netlify.com/t/support-guide-what-s-the-easiest-way-to-create-a-temporary-maintenance-page-for-my-site/338):

1. Put `index.html` (copy of `fallback.html`) in a folder.
2. Drag-and-drop deploy to the **production** site, or publish a `maintenance` branch deploy.
3. Restores normal service by re-publishing the last good production deploy from the Netlify UI.

---

## Verify primary is back

Before switching DNS back or disabling maintenance:

```bash
# HTTP status
curl -sI https://stormtracking.io | head -5

# No redirect loop (should settle on 200, not endless 301/302)
curl -sIL --max-redirs 5 https://stormtracking.io | grep -E '^HTTP|^location'

# Key routes
curl -sI https://stormtracking.io/radar | head -3
curl -sI https://stormtracking.io/alerts/texas | head -3
```

Manual checks:

- Homepage loads radar and alerts
- No console errors on `/radar`
- Sign-in / email signup not required for basic verification

---

## Checklist (quick reference)

**Outage detected**

- [ ] Confirm with `curl` / browser (not just one device)
- [ ] Identify type: redirect loop / deploy / DNS / Netlify
- [ ] Activate backup: DNS → `status.stormtracking.io`, or Netlify maintenance redirect, or publish maintenance deploy
- [ ] Optional: share status URL

**Recovery**

- [ ] Fix root cause on `main`, deploy
- [ ] Run verification commands above
- [ ] Disable maintenance redirect / restore DNS
- [ ] Update "Last updated" in `public/fallback.html` and `public/503.html` if messaging changed

---

## Files to keep in sync

When editing the outage message, update both:

- `public/fallback.html`
- `public/503.html`

If using a standalone backup repo or `status` branch, recopy `fallback.html` → `index.html` there.
