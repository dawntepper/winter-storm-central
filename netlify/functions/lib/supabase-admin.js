/**
 * Supabase Admin Client for Serverless Functions
 *
 * Uses the service role key to bypass RLS policies.
 * This client should ONLY be used in server-side functions,
 * never exposed to the client.
 */

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

/**
 * Check if an alert has already been sent
 */
async function isAlertSent(nwsAlertId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sent_alerts')
    .select('id')
    .eq('nws_alert_id', nwsAlertId)
    .eq('status', 'sent')
    .maybeSingle();

  if (error) {
    console.error('Error checking sent alert:', error);
    return false;
  }

  return !!data;
}

/**
 * Check multiple alerts at once, returns set of already-sent IDs
 */
async function getAlreadySentAlertIds(nwsAlertIds) {
  if (nwsAlertIds.length === 0) return new Set();

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sent_alerts')
    .select('nws_alert_id')
    .in('nws_alert_id', nwsAlertIds)
    .eq('status', 'sent');

  if (error) {
    console.error('Error checking sent alerts:', error);
    return new Set();
  }

  return new Set(data.map((row) => row.nws_alert_id));
}

/**
 * Record an alert as sent
 */
async function recordSentAlert({
  nwsAlertId,
  eventType,
  severity,
  affectedStates,
  areaDescription,
  headline,
  kitBroadcastIds,
  subscriberCount,
  statesNotified,
  alertOnset,
  alertExpires,
  status = 'sent',
  errorMessage = null,
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('sent_alerts')
    .insert({
      nws_alert_id: nwsAlertId,
      event_type: eventType,
      severity,
      affected_states: affectedStates,
      area_description: areaDescription,
      headline,
      kit_broadcast_ids: kitBroadcastIds,
      subscriber_count: subscriberCount,
      states_notified: statesNotified,
      alert_onset: alertOnset,
      alert_expires: alertExpires,
      status,
      error_message: errorMessage,
    })
    .select()
    .single();

  if (error) {
    console.error('Error recording sent alert:', error);
    throw error;
  }

  return data;
}

/**
 * Log a broadcast send attempt
 */
async function logBroadcastSend({
  sentAlertId,
  nwsAlertId,
  kitBroadcastId,
  targetState,
  status = 'created',
  errorMessage = null,
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('alert_email_log').insert({
    sent_alert_id: sentAlertId,
    nws_alert_id: nwsAlertId,
    kit_broadcast_id: kitBroadcastId,
    target_state: targetState,
    status,
    error_message: errorMessage,
  });

  if (error) {
    console.error('Error logging broadcast send:', error);
  }
}

/**
 * Clean up old sent alert records (older than 30 days)
 */
async function cleanupOldRecords(daysOld = 30) {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('sent_alerts')
    .delete()
    .lt('created_at', cutoff);

  if (error) {
    console.error('Error cleaning up old records:', error);
  }
}

module.exports = {
  getSupabaseAdmin,
  isAlertSent,
  getAlreadySentAlertIds,
  recordSentAlert,
  logBroadcastSend,
  cleanupOldRecords,
};
