-- Winter Storm Tracker Database Schema
-- Run this in your Supabase SQL Editor to set up the tables

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Tracks user premium subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'expired')),

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,

  -- Dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Ensure one active subscription per user
  CONSTRAINT unique_active_subscription UNIQUE (user_id, status)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);

-- RLS Policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update subscriptions (via webhooks)
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================
-- USER LOCATIONS TABLE
-- Syncs saved locations across devices
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Location data
  location_id TEXT NOT NULL, -- e.g., "user-12345" or "buffalo-ny"
  name TEXT NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lon DECIMAL(10, 7) NOT NULL,
  zip TEXT,

  -- Display settings
  show_on_map BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent duplicate locations for same user
  CONSTRAINT unique_user_location UNIQUE (user_id, location_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);

-- RLS Policies
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Users can read their own locations
CREATE POLICY "Users can view own locations"
  ON public.user_locations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own locations
CREATE POLICY "Users can insert own locations"
  ON public.user_locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own locations
CREATE POLICY "Users can update own locations"
  ON public.user_locations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own locations
CREATE POLICY "Users can delete own locations"
  ON public.user_locations FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- USER PREFERENCES TABLE
-- Stores user settings and preferences
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Notification preferences
  email_alerts BOOLEAN DEFAULT false,
  alert_threshold_snow DECIMAL(4, 1) DEFAULT 2.0, -- inches
  alert_threshold_ice DECIMAL(4, 2) DEFAULT 0.25, -- inches

  -- Display preferences
  default_view TEXT DEFAULT 'all' CHECK (default_view IN ('all', 'user')),
  show_radar BOOLEAN DEFAULT true,
  temperature_unit TEXT DEFAULT 'F' CHECK (temperature_unit IN ('F', 'C')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS Policies
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_locations_updated_at
  BEFORE UPDATE ON public.user_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SAMPLE QUERIES
-- ============================================

-- Get user's subscription status:
-- SELECT * FROM subscriptions WHERE user_id = auth.uid() AND status = 'active';

-- Get user's saved locations:
-- SELECT * FROM user_locations WHERE user_id = auth.uid() ORDER BY sort_order;

-- Check if user has premium:
-- SELECT EXISTS(
--   SELECT 1 FROM subscriptions
--   WHERE user_id = auth.uid()
--   AND status = 'active'
--   AND tier IN ('premium', 'pro')
--   AND (current_period_end IS NULL OR current_period_end > NOW())
-- ) as is_premium;
