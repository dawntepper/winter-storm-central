#!/usr/bin/env node

/**
 * Thin wrapper to invoke the test-dedup Netlify Function locally.
 *
 * Requires `netlify dev` to be running in another terminal so the Blobs
 * context is available. Run:
 *
 *   npm run test:dedup
 *
 * Against production (after deploy), prefer:
 *
 *   curl -X POST https://stormtracking.io/api/test-dedup \
 *     -H "Authorization: Bearer $ALERT_PROCESS_SECRET"
 */

const { spawnSync } = require('child_process');

const result = spawnSync('npx', ['netlify', 'functions:invoke', 'test-dedup', '--no-identity'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error('Failed to invoke test-dedup function.');
  console.error('Make sure the Netlify CLI is installed (`npm i -g netlify-cli`) and `netlify dev` is running in another terminal.');
  process.exit(1);
}

process.exit(result.status ?? 0);
