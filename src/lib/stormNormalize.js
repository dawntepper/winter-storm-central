/**
 * Shared normalization: DB rows / JSON files → camelCase storm event shape
 * consumed by StormEventPage, AdminStorms, App banner, etc.
 */

export function toArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return fallback;
}

export function normalizeEmergencySummary(raw) {
  if (!raw) return null;
  return {
    title: raw.title || '',
    items: toArray(raw.items),
    updatedAt: raw.updated_at || raw.updatedAt || null
  };
}

export function normalizeEmergencyEntry(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    title: raw.title || '',
    category: raw.category || 'Other',
    location: raw.location || '',
    description: raw.description || '',
    sourceName: raw.source_name || raw.sourceName || '',
    sourceUrl: raw.source_url || raw.sourceUrl || '',
    socialUrl: raw.social_url || raw.socialUrl || '',
    isOfficial: Boolean(raw.is_official ?? raw.isOfficial),
    status: raw.status || 'active',
    createdAt: raw.created_at || raw.createdAt || null,
    updatedAt: raw.updated_at || raw.updatedAt || null,
    expiresAt: raw.expires_at ?? raw.expiresAt ?? null,
    stormSlug: raw.storm_slug || raw.stormSlug || ''
  };
}

export function normalizeEmergencyEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeEmergencyEntry).filter(Boolean);
}

/** Map admin DB workflow status + content.public_status → public page status. */
export function resolvePublicStatus(row) {
  const content = row?.content || {};
  const publicStatus = content.public_status || content.publicStatus;
  if (row?.status === 'archived') return 'completed';
  if (row?.status === 'live') {
    return publicStatus || 'active';
  }
  if (row?.status === 'preview' || row?.status === 'draft') {
    return publicStatus || row.status;
  }
  return publicStatus || row?.status || 'draft';
}

/**
 * Normalize a static JSON storm file (snake_case, nested seo/map_center).
 */
export function normalizeJsonStorm(raw) {
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
    totalAlertsIssued: raw.total_alerts_issued ?? null,
    showEmergencyInfoPanel: Boolean(
      raw.show_emergency_info_panel ?? raw.showEmergencyInfoPanel ?? false
    ),
    emergencySummary: normalizeEmergencySummary(
      raw.emergency_summary ?? raw.emergencySummary
    ),
    emergencyEntries: normalizeEmergencyEntries(
      raw.emergency_entries ?? raw.emergencyEntries
    ),
    source: 'json',
    dbId: null,
    adminStatus: null,
    previewToken: null,
    publishedAt: null,
    locationLabel: null
  };
}

/**
 * Normalize a Supabase storms row joined with emergency tables.
 */
export function normalizeDbStorm(row, emergencySummary, emergencyInfo = []) {
  if (!row) return null;

  const content = row.content || {};
  const mapCenter = content.map_center || content.mapCenter || {};

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.storm_type,
    typeLabel: content.type_label || content.typeLabel || row.storm_type,
    status: resolvePublicStatus(row),
    startDate: row.start_date,
    endDate: row.end_date,
    description: row.summary || content.description || '',
    impacts: toArray(content.impacts),
    affectedStates: toArray(content.affected_states ?? content.affectedStates),
    alertCategories: toArray(content.alert_categories ?? content.alertCategories),
    mapCenter: {
      lat: mapCenter.latitude ?? mapCenter.lat ?? 39.0,
      lon: mapCenter.longitude ?? mapCenter.lon ?? -98.0
    },
    mapZoom: mapCenter.zoom ?? content.map_zoom ?? content.mapZoom ?? 5,
    seoTitle: row.seo_title || content.seo_title || '',
    seoDescription: row.seo_description || content.seo_description || '',
    ogImageUrl: content.og_image_url || content.ogImageUrl || '',
    keywords: toArray(content.keywords),
    peakAlertCount: content.peak_alert_count ?? content.peakAlertCount ?? null,
    totalAlertsIssued: content.total_alerts_issued ?? content.totalAlertsIssued ?? null,
    showEmergencyInfoPanel: Boolean(
      content.show_emergency_info_panel ?? content.showEmergencyInfoPanel ?? false
    ),
    emergencySummary: normalizeEmergencySummary(emergencySummary),
    emergencyEntries: normalizeEmergencyEntries(emergencyInfo).map(entry => ({
      ...entry,
      stormSlug: entry.stormSlug || row.slug
    })),
    source: 'db',
    dbId: row.id,
    adminStatus: row.status,
    previewToken: row.preview_token,
    publishedAt: row.published_at,
    locationLabel: row.location_label
  };
}

/** Admin form camelCase → DB insert/update payload. */
export function formDataToDbPayload(formData, adminStatus = 'draft') {
  const publicStatus = formData.status || 'draft';
  return {
    slug: formData.slug,
    title: formData.title,
    storm_type: formData.type,
    status: adminStatus,
    summary: formData.description || '',
    location_label: formData.locationLabel || null,
    start_date: formData.startDate,
    end_date: formData.endDate,
    seo_title: formData.seoTitle || null,
    seo_description: formData.seoDescription || null,
    content: {
      type_label: formData.typeLabel,
      public_status: publicStatus,
      impacts: (formData.impacts || []).filter(i => i && i.trim()),
      affected_states: formData.affectedStates || [],
      alert_categories: formData.alertCategories || [],
      map_center: {
        latitude: formData.mapCenter?.lat ?? 39.0,
        longitude: formData.mapCenter?.lon ?? -98.0,
        zoom: formData.mapZoom ?? 5
      },
      keywords: (formData.keywords || []).filter(k => k && k.trim()),
      og_image_url: formData.ogImageUrl || '',
      peak_alert_count: formData.peakAlertCount ?? null,
      total_alerts_issued: formData.totalAlertsIssued ?? null,
      show_emergency_info_panel: Boolean(formData.showEmergencyInfoPanel)
    },
    emergency_summary: formData.emergencySummary
      ? {
          title: formData.emergencySummary.title || 'Emergency Status',
          items: (formData.emergencySummary.items || []).filter(i => i && i.trim())
        }
      : null,
    emergency_entries: (formData.emergencyEntries || []).map((entry, index) => ({
      id: entry.id,
      title: entry.title || '',
      category: entry.category || 'Other',
      location: entry.location || '',
      description: entry.description || '',
      source_name: entry.sourceName || '',
      source_url: entry.sourceUrl || '',
      social_url: entry.socialUrl || '',
      is_official: Boolean(entry.isOfficial),
      status: entry.status || 'active',
      sort_order: index,
      expires_at: entry.expiresAt ?? null
    }))
  };
}

/** DB-normalized event → admin form shape (for edit). */
export function dbStormToFormData(event) {
  if (!event) return null;
  return {
    ...event,
    dbId: event.dbId,
    adminStatus: event.adminStatus,
    previewToken: event.previewToken,
    impacts: event.impacts?.length ? event.impacts : [''],
    keywords: event.keywords?.length ? event.keywords : [''],
    affectedStates: event.affectedStates || [],
    alertCategories: event.alertCategories || ['winter'],
    mapCenter: event.mapCenter || { lat: 39.0, lon: -98.0 },
    mapZoom: event.mapZoom ?? 5,
    peakAlertCount: event.peakAlertCount || null,
    totalAlertsIssued: event.totalAlertsIssued || null,
    showEmergencyInfoPanel: event.showEmergencyInfoPanel ?? false,
    emergencySummary: event.emergencySummary
      ? {
          ...event.emergencySummary,
          items: event.emergencySummary.items?.length
            ? event.emergencySummary.items
            : ['']
        }
      : { title: 'Emergency Status', items: [''], updatedAt: new Date().toISOString() },
    emergencyEntries: event.emergencyEntries?.length ? event.emergencyEntries : []
  };
}
