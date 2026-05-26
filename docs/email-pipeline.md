# Email Alert Pipeline

Two-tier server-side pipeline that delivers NWS alert emails to subscribers. The split exists because tornado warnings expire in 30-45 minutes and the digest-cadence pipeline would land emails after the warning was already over.

Last reviewed: 2026-05-26.

---

## Tiers

| Pipeline | Cron | Scope | File |
|---|---|---|---|
| **Standard** | `*/30 * * * *` (30 min) | All NWS alert types EXCEPT urgent ones | `netlify/functions/process-weather-alerts-background.js` |
| **Urgent** | `*/5 * * * *` (5 min) | Only urgent event types — short-fuse warnings | `netlify/functions/process-urgent-alerts-background.js` |

Urgent event types are defined in `shared/nws-alert-parser.js` as `URGENT_EVENT_TYPES`. Currently:

- **Tornado Warning**
- **Flash Flood Warning**

Watches are intentionally **not** urgent — only Warnings (action-required, minutes to act). The same set drives the client-side fast-refresh trigger in `useExtremeWeather`, so server and client can't drift.

---

## Shared infrastructure

Both pipelines import `processAlerts` from `netlify/functions/lib/alert-pipeline.js`. The shared module owns:

- NWS fetch + parse (`https://api.weather.gov/alerts/active`)
- Dedup against `SENT_ALERTS_STORE` Netlify Blob (keyed by NWS alert ID)
- Kit subscriber tag loading + state-tag bootstrapping
- County-precise + state-fallback subscriber matching
- Email render via `lib/email-templates.js`
- Batch send via `lib/resend-client.js`
- Per-alert record write to dedup store + broadcast log

Each pipeline file is a thin wrapper that supplies:

```js
processAlerts({
  pipelineName: 'standard' | 'urgent',  // log prefix
  filterAlerts: (alerts) => alerts,     // scope filter
  lockKey: 'lock' | 'lock-urgent',      // distinct locks per tier
});
```

---

## Dedup model

Both pipelines write to the same `sent-alerts` Netlify Blob, keyed by NWS alert ID. Before sending, each pipeline reads the set of already-sent IDs and filters them out.

**The shared dedup is the safety net, not the primary mechanism.** The scope filter is supposed to keep the two pipelines disjoint — urgent events flow to the urgent pipeline, everything else to standard. But if a bug ever caused both pipelines to consider the same alert in-scope, the dedup ensures only the first one to record it sends.

Records expire 30 days after `alertExpires` via `cleanupOldRecords(30)`. Cleanup runs probabilistically (≈2% chance per standard-pipeline invocation, never on urgent — urgent fires 12x more often and would over-clean).

---

## Locks

The two pipelines use **separate** Netlify Blob lock keys:

- Standard: `lock` (legacy key preserved)
- Urgent: `lock-urgent`

This is intentional. A shared lock would mean every 30 min when standard takes 3–4 min to run, urgent would be blocked and skip its slot — defeating the whole point of the urgent tier. Separate locks let both run truly independently.

Each pipeline self-serializes against its own lock so concurrent invocations of the *same* pipeline can't double-send.

---

## Subject line treatment

Single template, single email body — the user gets the same digest format whether the alert came from standard or urgent. Distinguishability is currently subject-line only:

`buildAlertSubject` in `lib/email-templates.js` prefixes `URGENT: ` to the subject when ANY of:

- `alert.severity === 'Extreme'` (rare — Tornado Emergency / PDS)
- `alert.event` is in `URGENT_EVENT_TYPES`

So a tornado warning from the urgent pipeline arrives as:

> 🚨 URGENT: Tornado Warning for Cleveland County, OK

While a heat advisory from the standard pipeline arrives as:

> 🚨 Heat Advisory for Phoenix, AZ

If post-launch subscriber feedback suggests the urgent emails need a different body template (separate "Take shelter NOW" framing), that's a follow-up — see the `email-templates.js` `CATEGORY_STYLES` block as the natural extension point.

---

## Cost / load

- Urgent pipeline: 288 invocations/day = 8,640/month. Netlify free tier is 125k/month, so urgent uses ~7% of the allowance even before counting other functions.
- NWS API: Pipeline A + Pipeline B together hit `api.weather.gov/alerts/active` ~336 times/day = ~14/hour. Well under NWS's 5 req/sec per-IP rate limit.
- Resend: per-alert per-subscriber, no change from before — the urgent pipeline just shortens the latency before sending.

---

## Testing without a real tornado

The cleanest path uses the existing HTTP-trigger pattern:

1. Set `ALERT_PROCESS_SECRET` env var on Netlify (used for manual invocation auth).
2. Temporarily add a frequently-fired NWS event type to `URGENT_EVENT_TYPES` (e.g. `'Special Weather Statement'`) in `shared/nws-alert-parser.js`. Deploy.
3. Wait for one to appear naturally in CONUS (frequent), or trigger via:
   ```
   curl -X POST https://stormtracking.io/.netlify/functions/process-urgent-alerts-background \
     -H "Authorization: Bearer $ALERT_PROCESS_SECRET"
   ```
4. Verify a test subscriber receives the urgent-formatted email (`URGENT:` subject prefix).
5. Confirm the standard pipeline's next run does NOT re-send the same alert (check Netlify function logs for the alert ID hitting the dedup set).
6. **Revert** the temporary addition to `URGENT_EVENT_TYPES`. Re-deploy.

For a fully synthetic test, the existing `netlify/functions/test-alert-email.js` already injects a fake parsed alert. Extend that pattern if you want a no-NWS-traffic verification path.

---

## Related files

- `netlify/functions/lib/alert-pipeline.js` — shared `processAlerts` logic
- `netlify/functions/lib/dedup-store.js` — Netlify Blobs adapter (sent-alerts + locks)
- `netlify/functions/lib/email-templates.js` — `buildAlertSubject` + `buildAlertEmail`
- `netlify/functions/lib/resend-client.js` — Resend SDK adapter
- `netlify/functions/lib/alert-matcher.js` — state/county tag computation
- `netlify/functions/lib/kit-client.js` — Kit (ConvertKit) v4 API adapter
- `shared/nws-alert-parser.js` — `URGENT_EVENT_TYPES`, `INCLUDED_EVENTS`, parser primitives shared client+server
- `netlify.toml` — schedule registration for both pipelines
