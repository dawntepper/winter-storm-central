# Bing Search Demand Analysis — StormTracking.io

Analysis of Bing Webmaster Tools **Search Performance** data for intent-based messaging and SEO priorities.

**Data sources**

| Source | Period | Scope |
| --- | --- | --- |
| Bing Webmaster screenshot (`searchperf`, 2026-06-08) | Last **30 days** | Top **50** of **298** keywords |
| Bing Webmaster screenshot (`searchperf`, 2026-05-24) | Last **7 days** | Top 25 keywords (validation) |
| `stormtracking.io_PageTrafficReport_5_24_2026.csv` | 7 days | Page-level clicks/impressions |

**Caveat:** Category totals below cover the **top 50 keywords only** (~50% of site impressions). Tail keywords may shift category mix slightly, but the top terms dominate click volume.

**Site totals (30 days, Bing):** 66.1K impressions · 1.8K clicks · **2.73% CTR**

---

## Intent categorization rules

Keywords assigned to **one** category (first match):

| Priority | Category | Match |
| ---: | --- | --- |
| 1 | **Hurricane** | `hurricane` |
| 2 | **Tornado** | `tornado` |
| 3 | **Forecast** | `forecast`, `outlook` |
| 4 | **Alerts** | `alert`, `warning`, `severe weather` (without `radar`) |
| 5 | **Radar** | `radar`, `doppler`, `loop` |
| 6 | **General Weather** | Everything else (`storm`, `storm tracker`, `noaa weather`, brand, etc.) |

---

## Category performance (top 50 keywords, 30 days)

| Category | Impressions | % of top-50 imps | Clicks | % of top-50 clicks | CTR |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Radar** | 16,448 | 50.1% | 114 | 11.3% | **0.69%** |
| **Hurricane** | 6,947 | 21.2% | 770 | 76.5% | **11.08%** |
| **General Weather** | 6,781 | 20.7% | 107 | 10.6% | **1.58%** |
| **Forecast** | 1,371 | 4.2% | 4 | 0.4% | 0.29% |
| **Tornado** | 852 | 2.6% | 9 | 0.9% | 1.06% |
| **Alerts** | 424 | 1.3% | 2 | 0.2% | 0.47% |
| **Top-50 subtotal** | 32,823 | 100% | 1,006 | 100% | 3.06% |

### Winners

| Metric | Leader | Insight |
| --- | --- | --- |
| **Most impressions** | Radar (50% of top-50) | Dominant discovery demand; users search NOAA/NWS radar terms |
| **Most clicks** | Hurricane (77% of top-50 clicks) | Almost entirely driven by **`hurricane tracker`** (770 clicks, 11.32% CTR) |
| **Highest CTR** | Hurricane (11.08%) | Tracker + hurricane intent matches product positioning |
| **Best non-hurricane CTR** | General Weather (1.58%) | `storm tracker`, `storm tracker live`, brand queries |

### Underperformers

| Category | Problem |
| --- | --- |
| **Radar** | Massive impressions, **0.69% CTR** — titles/snippets don’t match `nws radar`, `noaa radar`, `radar online` language |
| **Forecast** | Low volume + low CTR — `severe weather outlook` ranks but doesn’t compel clicks |
| **Alerts** | Minimal Bing demand in head terms — growth is long-tail (state/city), not generic “alerts” |

---

## Top keywords by category (30 days)

### Hurricane
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| hurricane tracker | 6,800 | 770 | 11.32% |
| noaa hurricane | 147 | 0 | 0.00% |

### Radar (selected)
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| nws radar | 5,800 | 9 | 0.16% |
| radar online | 2,100 | 4 | 0.19% |
| noaa radar | 1,800 | 5 | 0.27% |
| live weather radar | 765 | 20 | 2.61% |
| weather radar of my area right now | 187 | 12 | 6.42% |

### General Weather (selected)
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| storm | 2,500 | 7 | 0.28% |
| storm tracker | 1,500 | 56 | 3.85% |
| storm tracker live | 169 | 18 | 10.65% |
| stormtracking | 95 | 5 | 5.26% |

### Tornado
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| tornado tracker | 540 | 4 | 0.74% |
| tornado tracker live | 98 | 2 | 2.12% |
| live tornado tracker | 77 | 3 | 3.90% |

### Forecast
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| severe weather outlook | 1,300 | 4 | 0.31% |
| noaa severe weather outlook | 71 | 0 | 0.00% |

### Alerts
| Keyword | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| noaa severe weather map | 235 | 0 | 0.00% |
| severe weather | 133 | 2 | 1.50% |
| local weather news and severe alerts | 56 | 0 | 0.00% |

---

## Page-level signal (7 days, May 2026 export)

| Page | Impressions | Clicks | CTR |
| --- | ---: | ---: | ---: |
| `/` (homepage) | 10,861 | 174 | 1.60% |
| `/radar` | 4,739 | 110 | **2.32%** |
| State `/alerts/{state}` | &lt;50 combined | 2 | — |

**Insight:** `/radar` converts better than the homepage despite fewer impressions. Radar intent users who land on a dedicated radar URL click at a higher rate.

---

## Recommendations

### 1. Homepage messaging

**Current homepage title:** `Weather Near Me - Live Radar & Real-Time Storm Alerts | StormTracking`

**Problem:** Bing head terms split into three winning frames — **hurricane tracker** (clicks), **NWS/NOAA radar** (impressions), **storm tracker live** (CTR). The homepage title emphasizes “near me” and generic “storm alerts,” which under-match the highest-volume queries.

**Recommended seasonal split**

| Season | Hero / H1 emphasis | Supporting subhead |
| --- | --- | --- |
| **Jun–Nov (hurricane)** | **Live Hurricane Tracker** | Real-time Atlantic & Gulf storms with NWS radar and warnings |
| **Mar–Jun / fall (severe)** | **Live Storm & Tornado Tracker** | NWS radar, severe outlooks, and active warnings |
| **Winter** | **Live Weather Radar & Winter Storm Alerts** | NWS radar with ice, snow, and wind warnings |

**Always keep** a visible “near me” / geolocation path — `weather radar of my area right now` (6.42% CTR) proves local radar intent converts when the snippet promises immediacy.

### 2. Navigation labels

| Current | Recommended | Why |
| --- | --- | --- |
| Live Radar | **NWS Live Radar** | Matches `nws radar`, `noaa radar` query language |
| Live Alerts | **Active Warnings** or **Severe Weather Alerts** | Clearer than generic “alerts” for low-CTR outlook terms |
| (none seasonal) | **Hurricane Tracker** (Jun–Nov, when active) | 42%+ of site clicks from `hurricane tracker` |
| Storm banner | Keep prominent | `storm tracker` / `storm tracker live` CTR is strong |

### 3. Title tag templates

Align SERP copy with query vocabulary. Shorten titles; drop trailing brand where truncated.

| Page type | Current pattern | Recommended template |
| --- | --- | --- |
| **Homepage** | Weather Near Me - Live Radar &… | **Live NWS Radar & Hurricane Tracker — Storm Map** (seasonal variant) |
| **Radar** | Live Weather Radar Map \| Real-Time… | **NWS Live Radar Map — NOAA Precipitation & Storms** |
| **Homepage (alt / winter)** | — | **Live Weather Radar Near You — NWS Alerts & Storm Map** |
| **Storm page** | Custom `seo.title` | **{Storm Name} Tracker — Live Radar & NWS Warnings** |
| **State alerts** | {State} Weather Alerts — Live… | **{State} Weather Warnings Today — Live NWS Radar** |
| **City alerts** | {City}, {State} Weather Alerts & Forecast… | **{City}, {ST} Weather Warnings — Live Radar & NWS Alerts** |

**Radar CTR fix (highest ROI):** Homepage and `/radar` meta descriptions should lead with **“NWS”** or **“NOAA”** and **“live radar”** in the first 120 characters — e.g. *“Live NWS radar map with NOAA precipitation, storm tracking, and active weather warnings for your area.”*

### 4. Content priorities (by search demand)

| Priority | Focus | Rationale |
| ---: | --- | --- |
| **1** | **Hurricane tracker experience** | Single largest click driver; ensure homepage + storm pages satisfy “tracker” intent (map, status, cone/path when applicable) |
| **2** | **Radar page + homepage radar module** | 50% of impressions; fix snippet mismatch to capture `nws radar` / `noaa radar` traffic |
| **3** | **Storm tracker / live event pages** | Strong CTR on `storm tracker`, `storm tracker live`; promote active events in banner + IndexNow |
| **4** | **Localized radar copy** | “Near me / my area right now” variants convert well — keep geolocation + county highlight prominent |
| **5** | **City + state alert pages** | Low Bing head volume for “alerts” but strategic for long-tail and SEO depth (55 cities now live) |
| **6** | **Tornado tracker hub** (seasonal) | Spikes in keyword research (34K+ imps volume); surface during Dixie/Alley outbreaks |
| **7** | **Forecast / outlook** | Lower priority unless tied to SPC outlook UI or “severe weather outlook” landing section |

### 5. Quick wins (no new features)

1. **A/B homepage `<title>`** to include “Hurricane Tracker” during active tropical season.
2. **Update `/radar` title** to lead with “NWS Live Radar” (matches 5.8K imp `nws radar` term).
3. **Meta description** on homepage: first sentence = live NWS radar + hurricane/storm tracking.
4. **Storm event `seo.title`** audit — ensure “Tracker” appears in every active storm page.
5. **IndexNow** after title changes on homepage, `/radar`, and active `/storm/*` pages.

---

## Deploy note (2026-06-08)

City expansion + location analytics committed and pushed to `main` (`3e54cdb`). Netlify `npm run build` will regenerate static city HTML and sitemap automatically. IndexNow for new city URLs remains manual via `/admin/seo`.

---

## Follow-up data request

Export **all 298 keywords** from Bing Webmaster (Search Performance → Keywords → Export) to refine tail-category totals and validate hurricane-season vs off-season splits quarterly.
