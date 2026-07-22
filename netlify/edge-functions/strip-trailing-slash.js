// Netlify Edge Function: 301 trailing-slash URLs to the canonical no-slash form.
//
// Static pages live at dist/alerts/{slug}/index.html, so Netlify can serve BOTH
// /alerts/{slug} and /alerts/{slug}/ with 200. Google was indexing both and
// splitting signals. Canonical tags + sitemap already omit the slash; crawlers
// still need a server-side 301.
//
// History: a netlify.toml `/*/` → `/:splat` 301 looped when pretty_urls was on
// (e05d7ea). pretty_urls is now false; this edge redirect is the safe
// server-side enforcement (client StripTrailingSlash remains for SPA nav).

export default async (request, context) => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.length > 1 && pathname.endsWith('/')) {
    url.pathname = pathname.replace(/\/+$/, '');
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
};
