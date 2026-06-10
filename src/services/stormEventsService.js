/**
 * Storm Events Service
 *
 * Loads storms from Supabase (live/preview) with fallback to static JSON
 * files in src/content/storms/. JSON storms remain supported for SEO
 * prerender and legacy workflow.
 */

import {
  normalizeJsonStorm,
  normalizeDbStorm
} from '../lib/stormNormalize';
import {
  isStormsDbEnabled,
  listLiveStormsFromDb,
  getLiveStormBySlugFromDb,
  getPreviewStormBySlug,
  getStormFromAdminApi
} from '../lib/stormsRepo';

const stormModules = import.meta.glob('/src/content/storms/*.json', { eager: true });

const JSON_STORMS = Object.values(stormModules)
  .map(mod => normalizeJsonStorm(mod.default || mod))
  .filter(Boolean);

const JSON_BY_SLUG = new Map(JSON_STORMS.map(storm => [storm.slug, storm]));

function sortByStartDateDesc(a, b) {
  return (b.startDate || '').localeCompare(a.startDate || '');
}

function sortByStartDateAsc(a, b) {
  return (a.startDate || '').localeCompare(b.startDate || '');
}

function mergeStorms(dbStorms, jsonStorms) {
  const bySlug = new Map();
  for (const storm of jsonStorms) {
    bySlug.set(storm.slug, storm);
  }
  // DB live storms override JSON when slug collides
  for (const storm of dbStorms) {
    bySlug.set(storm.slug, storm);
  }
  return [...bySlug.values()];
}

async function loadDbStormsIfEnabled() {
  if (!isStormsDbEnabled()) return [];
  const { data, error } = await listLiveStormsFromDb();
  if (error) {
    console.warn('Supabase storms fetch failed, using JSON fallback:', error.message);
    return [];
  }
  return data || [];
}

export async function getAllStormEvents() {
  const dbStorms = await loadDbStormsIfEnabled();
  const merged = mergeStorms(dbStorms, JSON_STORMS);
  return { data: merged.sort(sortByStartDateDesc), error: null };
}

export async function getActiveStormEvents() {
  const dbStorms = await loadDbStormsIfEnabled();
  const merged = mergeStorms(dbStorms, JSON_STORMS);
  const data = merged
    .filter(s => s.status === 'active' || s.status === 'forecasted')
    .sort(sortByStartDateAsc);
  return { data, error: null };
}

/**
 * Fetch storm by slug. Options:
 * - previewToken: access draft/preview DB storms
 * - allowAdminPreview: sessionStorage admin_authenticated + previewToken from event
 */
export async function getStormEventBySlug(slug, options = {}) {
  const { previewToken, isAdminSession = false } = options;

  // 1. Live DB storm (overrides JSON)
  if (isStormsDbEnabled()) {
    const { data: liveStorm, error: liveError } = await getLiveStormBySlugFromDb(slug);
    if (liveError) {
      console.warn('Supabase live storm fetch error:', liveError.message);
    }
    if (liveStorm) {
      return { data: liveStorm, error: null };
    }

    // 2. Preview/draft via token
    if (previewToken) {
      const { data: previewStorm, error: previewError } = await getPreviewStormBySlug(slug, previewToken);
      if (previewError) {
        return { data: null, error: previewError };
      }
      if (previewStorm) {
        return { data: previewStorm, error: null };
      }
    }

    // 3. Admin session on preview route (no token required)
    if (isAdminSession) {
      try {
        const { data: adminStorm } = await getStormFromAdminApi(slug);
        if (adminStorm && ['draft', 'preview'].includes(adminStorm.adminStatus)) {
          return { data: adminStorm, error: null };
        }
      } catch (err) {
        console.warn('Admin preview fetch failed:', err.message);
      }
    }
  }

  // 4. Static JSON fallback (unchanged /storm/:slug behavior)
  const jsonStorm = JSON_BY_SLUG.get(slug) || null;
  if (jsonStorm) {
    return { data: jsonStorm, error: null };
  }

  return { data: null, error: 'Event not found' };
}

/** Export JSON catalog for build scripts / debugging. */
export function getJsonStormCatalog() {
  return JSON_STORMS;
}

export default {
  getAllStormEvents,
  getActiveStormEvents,
  getStormEventBySlug,
  getJsonStormCatalog
};
