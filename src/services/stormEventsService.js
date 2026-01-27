/**
 * Storm Events Service
 * Fetches and manages storm events from Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import stormEventsData from '../data/storm-events.json';

// Fallback to static JSON if Supabase not configured
const useFallback = !isSupabaseConfigured;

/**
 * Get all storm events
 */
export async function getAllStormEvents() {
  if (useFallback) {
    console.log('Using fallback storm events data');
    return { data: stormEventsData.events, error: null };
  }

  const { data, error } = await supabase
    .from('storm_events')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) {
    console.error('Error fetching storm events:', error);
    // Fallback to static data on error
    return { data: stormEventsData.events, error };
  }

  return { data: transformFromDb(data), error: null };
}

/**
 * Get active and forecasted storm events (for homepage)
 */
export async function getActiveStormEvents() {
  if (useFallback) {
    const active = stormEventsData.events.filter(
      e => e.status === 'active' || e.status === 'forecasted'
    );
    return { data: active, error: null };
  }

  const { data, error } = await supabase
    .from('storm_events')
    .select('*')
    .in('status', ['active', 'forecasted'])
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching active storm events:', error);
    const active = stormEventsData.events.filter(
      e => e.status === 'active' || e.status === 'forecasted'
    );
    return { data: active, error };
  }

  return { data: transformFromDb(data), error: null };
}

/**
 * Get a single storm event by slug
 */
export async function getStormEventBySlug(slug) {
  if (useFallback) {
    const event = stormEventsData.events.find(e => e.slug === slug);
    return { data: event || null, error: event ? null : 'Event not found' };
  }

  const { data, error } = await supabase
    .from('storm_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching storm event:', error);
    // Try fallback
    const fallbackEvent = stormEventsData.events.find(e => e.slug === slug);
    return { data: fallbackEvent || null, error };
  }

  return { data: transformSingleFromDb(data), error: null };
}

/**
 * Create a new storm event (admin only)
 */
export async function createStormEvent(event) {
  if (useFallback) {
    return { data: null, error: 'Supabase not configured' };
  }

  const dbEvent = transformToDb(event);

  const { data, error } = await supabase
    .from('storm_events')
    .insert([dbEvent])
    .select()
    .single();

  if (error) {
    console.error('Error creating storm event:', error);
    return { data: null, error };
  }

  return { data: transformSingleFromDb(data), error: null };
}

/**
 * Update a storm event (admin only)
 */
export async function updateStormEvent(id, updates) {
  if (useFallback) {
    return { data: null, error: 'Supabase not configured' };
  }

  const dbUpdates = transformToDb(updates);

  const { data, error } = await supabase
    .from('storm_events')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating storm event:', error);
    return { data: null, error };
  }

  return { data: transformSingleFromDb(data), error: null };
}

/**
 * Delete a storm event (admin only)
 */
export async function deleteStormEvent(id) {
  if (useFallback) {
    return { data: null, error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('storm_events')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting storm event:', error);
    return { success: false, error };
  }

  return { success: true, error: null };
}

/**
 * Transform database records to frontend format
 * Maps snake_case DB columns to camelCase JS properties
 */
function transformFromDb(records) {
  return records.map(transformSingleFromDb);
}

function transformSingleFromDb(record) {
  if (!record) return null;

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    type: record.type,
    typeLabel: record.type_label,
    status: record.status,
    startDate: record.start_date,
    endDate: record.end_date,
    description: record.description,
    impacts: record.impacts || [],
    // Historical stats (for completed storms)
    peakAlertCount: record.peak_alert_count,
    totalAlertsIssued: record.total_alerts_issued,
    affectedStates: record.affected_states || [],
    alertCategories: record.alert_categories || [],
    mapCenter: record.map_center || { lat: 39.0, lon: -98.0 },
    mapZoom: record.map_zoom || 5,
    keywords: record.keywords || [],
    seoTitle: record.seo_title,
    seoDescription: record.seo_description,
    created: record.created_at,
    updated: record.updated_at
  };
}

/**
 * Transform frontend format to database format
 * Maps camelCase JS properties to snake_case DB columns
 */
function transformToDb(event) {
  const dbEvent = {};

  if (event.slug !== undefined) dbEvent.slug = event.slug;
  if (event.title !== undefined) dbEvent.title = event.title;
  if (event.type !== undefined) dbEvent.type = event.type;
  if (event.typeLabel !== undefined) dbEvent.type_label = event.typeLabel;
  if (event.status !== undefined) dbEvent.status = event.status;
  if (event.startDate !== undefined) dbEvent.start_date = event.startDate;
  if (event.endDate !== undefined) dbEvent.end_date = event.endDate;
  if (event.description !== undefined) dbEvent.description = event.description;
  if (event.impacts !== undefined) dbEvent.impacts = event.impacts;
  if (event.affectedStates !== undefined) dbEvent.affected_states = event.affectedStates;
  if (event.alertCategories !== undefined) dbEvent.alert_categories = event.alertCategories;
  if (event.mapCenter !== undefined) dbEvent.map_center = event.mapCenter;
  if (event.mapZoom !== undefined) dbEvent.map_zoom = event.mapZoom;
  if (event.keywords !== undefined) dbEvent.keywords = event.keywords;
  if (event.seoTitle !== undefined) dbEvent.seo_title = event.seoTitle;
  if (event.seoDescription !== undefined) dbEvent.seo_description = event.seoDescription;
  // Historical stats
  if (event.peakAlertCount !== undefined) dbEvent.peak_alert_count = event.peakAlertCount;
  if (event.totalAlertsIssued !== undefined) dbEvent.total_alerts_issued = event.totalAlertsIssued;

  return dbEvent;
}

export default {
  getAllStormEvents,
  getActiveStormEvents,
  getStormEventBySlug,
  createStormEvent,
  updateStormEvent,
  deleteStormEvent
};
