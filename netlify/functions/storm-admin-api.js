/**
 * Storm Admin API — password-gated CRUD using Supabase service role.
 * Validates ADMIN_PASSWORD (server) against client-supplied password.
 */

const { getSupabaseAdmin } = require('./lib/supabase-admin');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;
const BUILD_HOOK_URL = process.env.NETLIFY_BUILD_HOOK_URL || process.env.VITE_NETLIFY_BUILD_HOOK_URL;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body)
  };
}

function assertAdmin(password) {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD not configured on server');
  }
  if (!password || password !== ADMIN_PASSWORD) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

function formDataToDbPayload(formData, adminStatus = 'draft') {
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
      impacts: (formData.impacts || []).filter((i) => i && i.trim()),
      affected_states: formData.affectedStates || [],
      alert_categories: formData.alertCategories || [],
      map_center: {
        latitude: formData.mapCenter?.lat ?? 39.0,
        longitude: formData.mapCenter?.lon ?? -98.0,
        zoom: formData.mapZoom ?? 5
      },
      keywords: (formData.keywords || []).filter((k) => k && k.trim()),
      og_image_url: formData.ogImageUrl || '',
      peak_alert_count: formData.peakAlertCount ?? null,
      total_alerts_issued: formData.totalAlertsIssued ?? null,
      show_emergency_info_panel: Boolean(formData.showEmergencyInfoPanel)
    },
    emergency_summary: formData.emergencySummary
      ? {
          title: formData.emergencySummary.title || 'Emergency Status',
          items: (formData.emergencySummary.items || []).filter((i) => i && i.trim())
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

async function upsertEmergencyData(supabase, stormId, payload) {
  if (payload.emergency_summary) {
    const { error } = await supabase
      .from('storm_emergency_summary')
      .upsert(
        {
          storm_id: stormId,
          title: payload.emergency_summary.title,
          items: payload.emergency_summary.items,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'storm_id' }
      );
    if (error) throw error;
  } else {
    await supabase.from('storm_emergency_summary').delete().eq('storm_id', stormId);
  }

  await supabase.from('storm_emergency_info').delete().eq('storm_id', stormId);

  if (payload.emergency_entries?.length) {
    const rows = payload.emergency_entries.map((entry) => ({
      id: entry.id,
      storm_id: stormId,
      title: entry.title,
      category: entry.category,
      location: entry.location,
      description: entry.description,
      source_name: entry.source_name,
      source_url: entry.source_url,
      social_url: entry.social_url,
      is_official: entry.is_official,
      status: entry.status,
      sort_order: entry.sort_order,
      expires_at: entry.expires_at
    }));
    const { error } = await supabase.from('storm_emergency_info').insert(rows);
    if (error) throw error;
  }
}

async function fetchStormBundle(supabase, stormRow) {
  const [summaryRes, entriesRes] = await Promise.all([
    supabase
      .from('storm_emergency_summary')
      .select('*')
      .eq('storm_id', stormRow.id)
      .maybeSingle(),
    supabase
      .from('storm_emergency_info')
      .select('*')
      .eq('storm_id', stormRow.id)
      .order('sort_order', { ascending: true })
  ]);

  return {
    storm: stormRow,
    emergency_summary: summaryRes.data || null,
    emergency_info: entriesRes.data || []
  };
}

async function handleList(supabase) {
  const { data, error } = await supabase
    .from('storms')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const bundles = await Promise.all((data || []).map((row) => fetchStormBundle(supabase, row)));
  return { data: bundles };
}

async function handleSave(supabase, formData, adminStatus, existingId) {
  const payload = formDataToDbPayload(formData, adminStatus);
  const now = new Date().toISOString();

  let stormRow;
  if (existingId) {
    const { data, error } = await supabase
      .from('storms')
      .update({
        slug: payload.slug,
        title: payload.title,
        storm_type: payload.storm_type,
        status: payload.status,
        summary: payload.summary,
        location_label: payload.location_label,
        start_date: payload.start_date,
        end_date: payload.end_date,
        seo_title: payload.seo_title,
        seo_description: payload.seo_description,
        content: payload.content,
        updated_at: now
      })
      .eq('id', existingId)
      .select('*')
      .single();
    if (error) throw error;
    stormRow = data;
  } else {
    const { data, error } = await supabase
      .from('storms')
      .insert({
        slug: payload.slug,
        title: payload.title,
        storm_type: payload.storm_type,
        status: payload.status,
        summary: payload.summary,
        location_label: payload.location_label,
        start_date: payload.start_date,
        end_date: payload.end_date,
        seo_title: payload.seo_title,
        seo_description: payload.seo_description,
        content: payload.content
      })
      .select('*')
      .single();
    if (error) throw error;
    stormRow = data;
  }

  await upsertEmergencyData(supabase, stormRow.id, payload);
  return fetchStormBundle(supabase, stormRow);
}

async function handleStatusChange(supabase, slug, status, setPublished = false) {
  const updates = { status, updated_at: new Date().toISOString() };
  if (setPublished) updates.published_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('storms')
    .update(updates)
    .eq('slug', slug)
    .select('*')
    .single();

  if (error) throw error;
  return fetchStormBundle(supabase, data);
}

async function triggerBuildHook() {
  if (!BUILD_HOOK_URL) {
    return { triggered: false, reason: 'NETLIFY_BUILD_HOOK_URL not configured' };
  }
  const res = await fetch(BUILD_HOOK_URL, { method: 'POST' });
  return { triggered: res.ok, status: res.status };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    assertAdmin(body.password);

    const { action } = body;

    if (action === 'validate') {
      return jsonResponse(200, { ok: true });
    }

    const supabase = getSupabaseAdmin();

    switch (action) {
      case 'list': {
        const result = await handleList(supabase);
        return jsonResponse(200, result);
      }
      case 'get': {
        const { data, error } = await supabase
          .from('storms')
          .select('*')
          .eq('slug', body.slug)
          .maybeSingle();
        if (error) throw error;
        if (!data) return jsonResponse(404, { error: 'Storm not found' });
        const bundle = await fetchStormBundle(supabase, data);
        return jsonResponse(200, { data: bundle });
      }
      case 'save': {
        const bundle = await handleSave(
          supabase,
          body.formData,
          body.adminStatus || 'draft',
          body.existingId || body.formData?.dbId || null
        );
        return jsonResponse(200, { data: bundle });
      }
      case 'preview': {
        const bundle = await handleStatusChange(supabase, body.slug, 'preview');
        return jsonResponse(200, { data: bundle });
      }
      case 'publish': {
        const bundle = await handleStatusChange(supabase, body.slug, 'live', true);
        const hook = await triggerBuildHook();
        return jsonResponse(200, { data: bundle, buildHook: hook });
      }
      case 'archive': {
        const bundle = await handleStatusChange(supabase, body.slug, 'archived');
        const hook = await triggerBuildHook();
        return jsonResponse(200, { data: bundle, buildHook: hook });
      }
      default:
        return jsonResponse(400, { error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('storm-admin-api error:', err);
    const status = err.statusCode || 500;
    return jsonResponse(status, { error: err.message || 'Internal error' });
  }
};
