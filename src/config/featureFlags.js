/**
 * Site-wide feature flags.
 *
 * AFFILIATE_LINKS_ENABLED
 * -----------------------
 * Gates the /prep affiliate hub from showing in nav/footer/homepage/state-page
 * placements until Dawn has populated real Amazon Associates URLs in
 * src/data/affiliateProducts.js. The route still resolves and the page still
 * renders (so Dawn can review it directly), but EssentialsCard returns null
 * and no in-content links to /prep are surfaced when this flag is false.
 *
 * Set VITE_AFFILIATE_LINKS_ENABLED=true in Netlify env vars to enable.
 * Defaults to false when the var is unset / undefined / any non-'true' value —
 * this is the safer default and prevents accidental dev/preview leaks.
 */
export const AFFILIATE_LINKS_ENABLED =
  import.meta.env.VITE_AFFILIATE_LINKS_ENABLED === 'true';
