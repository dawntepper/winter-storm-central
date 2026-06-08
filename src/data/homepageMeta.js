/**
 * Canonical homepage meta — the single source of truth that every page's
 * resetMetaTags() restores when it unmounts back toward the homepage.
 *
 * These MUST stay in sync with the static tags in index.html (the crawler-
 * facing default). Before this module existed, each page hardcoded its own
 * "homepage default" strings, which had already drifted into 2–3 different
 * wordings; an in-session share after navigating home could restore stale
 * copy. Import from here instead of re-typing the strings.
 */
export const HOMEPAGE_META = {
  title: 'Live Weather Radar Near You — NWS Alerts & Storm Map',
  description:
    'See active NWS warnings on a live radar map for your area. Tornado, flood, winter storm, and hurricane alerts — free and updated in real time.',
  ogTitle: 'Live Weather Radar Near You — NWS Alerts & Storm Map',
  ogDescription:
    'See active NWS warnings on a live radar map for your area. Tornado, flood, winter storm, and hurricane alerts — free and updated in real time.',
  twitterTitle: 'Live Weather Radar Near You — NWS Alerts & Storm Map',
  twitterDescription:
    'See active NWS warnings on a live radar map for your area. Tornado, flood, winter storm, and hurricane alerts — free and updated in real time.',
  url: 'https://stormtracking.io',
  image: 'https://stormtracking.io/og-image.png',
  keywords:
    'weather near me, weather radar near me, weather radar, live weather radar, radar weather, weather map, storm tracking, severe weather alerts, real-time weather, interactive radar, storm radar',
};
