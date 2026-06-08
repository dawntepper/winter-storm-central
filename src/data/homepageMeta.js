/**
 * Canonical homepage meta — the single source of truth that every page's
 * resetMetaTags() restores when it unmounts back toward the homepage.
 *
 * Seasonal title/description variants follow docs/bing-search-demand-analysis.md
 * (Northern Hemisphere, US-focused). HOMEPAGE_META holds the default/off-season
 * copy; getSeasonalHomepageMeta() picks the active season at runtime and build time.
 *
 * Static tags in index.html use the default copy as the dev/crawler fallback;
 * `npm run build` patches dist/index.html with the current season via
 * scripts/generate-static-pages.js.
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

const SEASONAL_COPY = {
  hurricane: {
    title: 'Live NWS Radar & Hurricane Tracker — Storm Map',
    description:
      'Track Atlantic and Gulf hurricanes with live NWS radar and active warnings. Tornado, flood, and storm alerts for your area — free, updated in real time.',
  },
  severe: {
    title: 'Live Storm & Tornado Tracker — NWS Radar & Warnings',
    description:
      'Track severe thunderstorms and tornadoes with live NWS radar and active warnings. Real-time alerts for your area — free, updated continuously.',
  },
  winter: {
    title: 'Live Weather Radar & Winter Storm Alerts — NWS Map',
    description:
      'Track winter storms, ice, and snow with live NWS radar and active warnings. Real-time alerts for your area — free, updated in real time.',
  },
};

/**
 * Northern Hemisphere season for homepage SEO copy.
 * Jan–Feb & Dec = winter; Mar–May = severe/spring; Jun–Nov = hurricane.
 */
export function getHomepageSeason(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan … 11 = Dec
  if (month === 11 || month <= 1) return 'winter';
  if (month >= 2 && month <= 4) return 'severe';
  if (month >= 5 && month <= 10) return 'hurricane';
  return 'default';
}

/** Returns full homepage meta for the given date, merging seasonal copy with shared fields. */
export function getSeasonalHomepageMeta(date = new Date()) {
  const season = getHomepageSeason(date);
  const copy = SEASONAL_COPY[season];
  const title = copy?.title ?? HOMEPAGE_META.title;
  const description = copy?.description ?? HOMEPAGE_META.description;

  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    twitterTitle: title,
    twitterDescription: description,
    url: HOMEPAGE_META.url,
    image: HOMEPAGE_META.image,
    keywords: HOMEPAGE_META.keywords,
    season,
  };
}

function setMeta(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

/** Apply seasonal (or default) homepage meta tags to the current document. */
export function setHomepageMetaTags(date = new Date()) {
  const meta = getSeasonalHomepageMeta(date);

  document.title = meta.title;
  setMeta('meta[name="title"]', 'content', meta.title);
  setMeta('meta[name="description"]', 'content', meta.description);
  setMeta('meta[property="og:title"]', 'content', meta.ogTitle);
  setMeta('meta[property="og:description"]', 'content', meta.ogDescription);
  setMeta('meta[property="og:url"]', 'content', meta.url);
  setMeta('meta[property="og:image"]', 'content', meta.image);
  setMeta('meta[name="twitter:title"]', 'content', meta.twitterTitle);
  setMeta('meta[name="twitter:description"]', 'content', meta.twitterDescription);
  setMeta('meta[property="twitter:title"]', 'content', meta.twitterTitle);
  setMeta('meta[property="twitter:description"]', 'content', meta.twitterDescription);
  setMeta('meta[property="twitter:image"]', 'content', meta.image);
  setMeta('link[rel="canonical"]', 'href', meta.url);
  setMeta('meta[name="keywords"]', 'content', meta.keywords);
}
