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
  title: 'Weather Near Me - Live Radar & Real-Time Storm Alerts | StormTracking',
  description:
    'Track severe weather near me with live radar maps and real-time NWS alerts. Find storms, winter weather, hurricanes, and active warnings for your local area instantly. Free NOAA/NWS data.',
  ogTitle: 'StormTracking - Live Weather Radar & Real-Time Alerts',
  ogDescription:
    'Track severe weather near me with live radar maps and real-time alerts from NOAA/NWS. Free interactive weather radar for storms, winter weather, hurricanes, and active warnings in your local area.',
  twitterTitle: 'StormTracking - Live Weather Radar & Storm Alerts',
  twitterDescription:
    'Find weather near me with live radar and real-time severe weather alerts. Track storms with interactive radar maps from NOAA/NWS.',
  url: 'https://stormtracking.io',
  image: 'https://stormtracking.io/og-image.png',
  keywords:
    'weather near me, weather radar near me, weather radar, live weather radar, radar weather, weather map, storm tracking, severe weather alerts, real-time weather, interactive radar, storm radar',
};
