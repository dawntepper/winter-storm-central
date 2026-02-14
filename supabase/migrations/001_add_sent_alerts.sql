-- ============================================
-- SENT ALERTS TRACKING TABLE
-- Tracks which NWS alerts have been processed
-- to prevent duplicate email sends
-- ============================================

CREATE TABLE IF NOT EXISTS public.sent_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- NWS alert identifier (from NOAA API)
  nws_alert_id TEXT NOT NULL UNIQUE,

  -- Alert metadata for debugging
  event_type TEXT NOT NULL,           -- e.g., "Winter Storm Warning"
  severity TEXT,                       -- e.g., "Severe", "Moderate"
  affected_states TEXT[] DEFAULT '{}', -- e.g., {"NY", "PA", "NJ"}
  area_description TEXT,               -- Full area description from NWS
  headline TEXT,                       -- Alert headline

  -- Kit broadcast tracking
  kit_broadcast_ids TEXT[] DEFAULT '{}', -- Kit broadcast IDs created for this alert
  subscriber_count INTEGER DEFAULT 0,   -- Number of subscribers notified
  states_notified TEXT[] DEFAULT '{}',   -- States that received the broadcast

  -- Alert timing
  alert_onset TIMESTAMPTZ,             -- When the alert becomes effective
  alert_expires TIMESTAMPTZ,           -- When the alert expires

  -- Processing metadata
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,                  -- Error details if status = 'failed'

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for quick lookups by NWS alert ID
CREATE INDEX IF NOT EXISTS idx_sent_alerts_nws_id ON public.sent_alerts(nws_alert_id);

-- Index for querying by status and time
CREATE INDEX IF NOT EXISTS idx_sent_alerts_status ON public.sent_alerts(status, processed_at);

-- Index for querying by state
CREATE INDEX IF NOT EXISTS idx_sent_alerts_states ON public.sent_alerts USING GIN(affected_states);

-- Auto-cleanup: alerts older than 30 days can be pruned
CREATE INDEX IF NOT EXISTS idx_sent_alerts_created ON public.sent_alerts(created_at);


-- ============================================
-- ALERT EMAIL LOG TABLE
-- Detailed log of each email sent for auditing
-- ============================================

CREATE TABLE IF NOT EXISTS public.alert_email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- References
  sent_alert_id UUID REFERENCES public.sent_alerts(id) ON DELETE CASCADE,
  nws_alert_id TEXT NOT NULL,

  -- Kit broadcast details
  kit_broadcast_id TEXT,
  target_state TEXT,                   -- State tag this broadcast targeted

  -- Result tracking
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'sent', 'failed')),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_email_log_alert ON public.alert_email_log(sent_alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_email_log_nws ON public.alert_email_log(nws_alert_id);


-- ============================================
-- RLS POLICIES
-- Only service role can access these tables
-- (called from serverless functions)
-- ============================================

ALTER TABLE public.sent_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages sent_alerts"
  ON public.sent_alerts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages alert_email_log"
  ON public.alert_email_log FOR ALL
  USING (auth.role() = 'service_role');
