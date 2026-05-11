/**
 * Storm Events Service
 *
 * Storm events are static JSON files committed to the repo at src/content/storms/.
 * Vite eagerly imports all of them at build time, so the entire catalog is bundled
 * into the client. There is no database and no network call.
 *
 * JSON schema (snake_case, nested seo/map_center) → normalized to camelCase here so
 * existing components (StormEventPage, AdminStorms, etc.) keep working unchanged.
 */

const stormModules = import.meta.glob('/src/content/storms/*.json', { eager: true });

function toArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return fallback;
}

function normalize(raw) {
  if (!raw) return null;

  const mapCenter = raw.map_center || {};
  const seo = raw.seo || {};

  return {
    id: raw.slug,
    slug: raw.slug,
    title: raw.title,
    type: raw.type,
    typeLabel: raw.type_label || raw.typeLabel || raw.type,
    status: raw.status,
    startDate: raw.start_date,
    endDate: raw.end_date,
    description: raw.description,
    impacts: toArray(raw.impacts),
    affectedStates: toArray(raw.affected_states),
    alertCategories: toArray(raw.alert_categories),
    mapCenter: {
      lat: mapCenter.latitude ?? mapCenter.lat ?? 39.0,
      lon: mapCenter.longitude ?? mapCenter.lon ?? -98.0
    },
    mapZoom: mapCenter.zoom ?? raw.map_zoom ?? 5,
    seoTitle: seo.title || raw.seo_title || '',
    seoDescription: seo.description || raw.seo_description || '',
    ogImageUrl: seo.og_image_url || raw.og_image_url || '',
    keywords: toArray(seo.keywords ?? raw.keywords),
    peakAlertCount: raw.peak_alert_count ?? null,
    totalAlertsIssued: raw.total_alerts_issued ?? null
  };
}

// Build the catalog once at module load.
const ALL_STORMS = Object.values(stormModules)
  .map(mod => normalize(mod.default || mod))
  .filter(Boolean);

const BY_SLUG = new Map(ALL_STORMS.map(storm => [storm.slug, storm]));

function sortByStartDateDesc(a, b) {
  return (b.startDate || '').localeCompare(a.startDate || '');
}

function sortByStartDateAsc(a, b) {
  return (a.startDate || '').localeCompare(b.startDate || '');
}

export async function getAllStormEvents() {
  const data = [...ALL_STORMS].sort(sortByStartDateDesc);
  return { data, error: null };
}

export async function getActiveStormEvents() {
  const data = ALL_STORMS
    .filter(s => s.status === 'active' || s.status === 'forecasted')
    .sort(sortByStartDateAsc);
  return { data, error: null };
}

export async function getStormEventBySlug(slug) {
  const data = BY_SLUG.get(slug) || null;
  return { data, error: data ? null : 'Event not found' };
}

export default {
  getAllStormEvents,
  getActiveStormEvents,
  getStormEventBySlug
};
