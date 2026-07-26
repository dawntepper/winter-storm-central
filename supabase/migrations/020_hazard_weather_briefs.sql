-- ============================================
-- HAZARD WEATHER BRIEFS
-- StormTracking-generated editorial content only.
-- NWS alerts / geometry / counties are NOT stored here.
-- ============================================

CREATE TABLE IF NOT EXISTS public.hazard_weather_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- One cached brief per hazard slug (e.g. tornado-warning)
  hazard_slug TEXT NOT NULL UNIQUE,

  -- Claude-generated (or last accepted) summary text
  summary TEXT,

  -- Manual editorial override
  manual_summary TEXT,
  manual_override BOOLEAN NOT NULL DEFAULT false,

  notable_change TEXT,

  -- Metadata snapshot at generation time (not a live weather store)
  active_count INTEGER NOT NULL DEFAULT 0,
  affected_state_codes TEXT[] NOT NULL DEFAULT '{}',
  source_alert_ids TEXT[] NOT NULL DEFAULT '{}',
  data_signature TEXT,

  model TEXT,
  prompt_version TEXT,

  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'stale', 'failed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazard_weather_briefs_slug
  ON public.hazard_weather_briefs (hazard_slug);

CREATE INDEX IF NOT EXISTS idx_hazard_weather_briefs_generated_at
  ON public.hazard_weather_briefs (generated_at DESC);

-- Keep updated_at current on every update
CREATE OR REPLACE FUNCTION public.set_hazard_weather_briefs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hazard_weather_briefs_updated_at
  ON public.hazard_weather_briefs;

CREATE TRIGGER trg_hazard_weather_briefs_updated_at
  BEFORE UPDATE ON public.hazard_weather_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_hazard_weather_briefs_updated_at();


-- ============================================
-- HAZARD WEATHER BRIEF HISTORY
-- Append-only editorial archive. Never overwrite.
-- ============================================

CREATE TABLE IF NOT EXISTS public.hazard_weather_brief_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  hazard_slug TEXT NOT NULL,
  summary TEXT,
  active_count INTEGER NOT NULL DEFAULT 0,
  affected_state_codes TEXT[] NOT NULL DEFAULT '{}',
  source_alert_ids TEXT[] NOT NULL DEFAULT '{}',
  model TEXT,
  prompt_version TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazard_weather_brief_history_slug_generated
  ON public.hazard_weather_brief_history (hazard_slug, generated_at DESC);


-- ============================================
-- RLS
-- Public: read current briefs (editorial display)
-- Service role: full write access
-- History: service-role insert; public read for admin later via service API
-- ============================================

ALTER TABLE public.hazard_weather_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazard_weather_brief_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read hazard_weather_briefs"
  ON public.hazard_weather_briefs
  FOR SELECT
  USING (true);

CREATE POLICY "Service role manages hazard_weather_briefs"
  ON public.hazard_weather_briefs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public can read hazard_weather_brief_history"
  ON public.hazard_weather_brief_history
  FOR SELECT
  USING (true);

CREATE POLICY "Service role inserts hazard_weather_brief_history"
  ON public.hazard_weather_brief_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
