#!/usr/bin/env node

/**
 * Post-build IndexNow submission — notifies Bing after deploy-time build.
 *
 * Complements /admin/seo (manual bulk/custom URLs on demand). This script
 * auto-submits the full prerender route list on every Netlify build when
 * INDEXNOW_KEY is set. Admin UI remains useful for ad-hoc re-submits without
 * triggering a full deploy.
 */

const fs = require('fs');
const path = require('path');

const { ROOT, BASE_URL } = require('./lib/sitemap-routes');

const HOST = 'stormtracking.io';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
const MAX_URLS_PER_BATCH = 10000;

function readPrerenderRoutes() {
  const candidates = [
    path.join(ROOT, 'dist', 'prerender-routes.json'),
    path.join(ROOT, 'public', 'prerender-routes.json'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const routes = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(routes) && routes.length) return routes;
  }

  return [];
}

function routesToAbsoluteUrls(routes) {
  return routes.map((route) => {
    if (route === '/') return `${BASE_URL}/`;
    return `${BASE_URL}${route.startsWith('/') ? route : `/${route}`}`;
  });
}

async function submitBatch({ urls, key, keyLocation }) {
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation,
      urlList: urls,
    }),
  });

  let body = '';
  try {
    body = await response.text();
  } catch {
    /* ignore */
  }

  return { status: response.status, body };
}

async function main() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    console.log('INDEXNOW_KEY not set — skipping post-build IndexNow submission');
    process.exit(0);
  }

  const routes = readPrerenderRoutes();
  if (!routes.length) {
    console.log('No prerender routes found — skipping IndexNow submission');
    process.exit(0);
  }

  const urls = routesToAbsoluteUrls(routes);
  const keyLocation = `${BASE_URL}/${key}.txt`;
  const batches = [];

  for (let i = 0; i < urls.length; i += MAX_URLS_PER_BATCH) {
    batches.push(urls.slice(i, i + MAX_URLS_PER_BATCH));
  }

  console.log(`[indexnow] post-build submitting ${urls.length} URL(s) in ${batches.length} batch(es)`);

  let submitted = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const { status, body } = await submitBatch({ urls: batch, key, keyLocation });
    console.log(`[indexnow] batch ${i + 1}/${batches.length} → status=${status} urls=${batch.length}`);

    if (status === 200 || status === 202) {
      submitted += batch.length;
      continue;
    }

    console.error(`[indexnow] batch ${i + 1} failed status=${status} body=${body.slice(0, 200)}`);
    process.exit(1);
  }

  console.log(`[indexnow] submitted ${submitted} URL(s)`);
}

main().catch((err) => {
  console.error('[indexnow] post-build error:', err.message);
  process.exit(1);
});
