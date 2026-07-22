// Netlify Edge Function: 301 trailing-slash URLs to the canonical no-slash form.
//
// Static pages live at dist/alerts/{slug}/index.html, so Netlify can serve BOTH
// /alerts/{slug} and /alerts/{slug}/ with 200. Google was indexing both and
// splitting signals. Canonical tags + sitemap already omit the slash; crawlers
// still need a server-side 301.
//
// History: a netlify.toml `/*/` → `/:splat` 301 self-redirected canonical
// no-slash URLs (and looped when pretty_urls was on). Site-level Pretty URLs
// must stay OFF (processing_settings.html.pretty_urls=false). This edge
// function is the safe server-side enforcement; client StripTrailingSlash
// remains for SPA nav.

export default async (request, context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Only strip when there is a real trailing slash on a non-root path.
  if (pathname === '/' || !pathname.endsWith('/')) {
    return context.next();
  }

  const stripped = pathname.replace(/\/+$/, '');
  // Guard against empty / no-op redirects (would 301 a URL onto itself).
  if (!stripped || stripped === pathname) {
    return context.next();
  }

  url.pathname = stripped;
  return Response.redirect(url.toString(), 301);
};
