/**
 * Subscription Hook
 *
 * Manages premium subscription state.
 * Checks if user has active premium access.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';

// Subscription tiers
export const TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PRO: 'pro'
};

// Feature flags by tier
export const TIER_FEATURES = {
  [TIERS.FREE]: {
    forecastData: true,
    customLocations: 3,
    locationSync: false,
    actualAccumulations: false,
    historicalData: false,
    apiAccess: false
  },
  [TIERS.PREMIUM]: {
    forecastData: true,
    customLocations: 10,
    locationSync: true,
    actualAccumulations: true,
    historicalData: false,
    apiAccess: false
  },
  [TIERS.PRO]: {
    forecastData: true,
    customLocations: 50,
    locationSync: true,
    actualAccumulations: true,
    historicalData: true,
    apiAccess: true
  }
};

/**
 * Hook to manage subscription state
 */
export function useSubscription() {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription status
  const fetchSubscription = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (user has no subscription)
        throw error;
      }

      setSubscription(data || null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch on auth change
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Subscribe to realtime subscription changes
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Subscription changed:', payload);
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSubscription]);

  // Computed properties
  const tier = subscription?.tier || TIERS.FREE;
  const features = TIER_FEATURES[tier];
  const isPremium = tier === TIERS.PREMIUM || tier === TIERS.PRO;
  const isPro = tier === TIERS.PRO;

  // Check if a specific feature is available
  const hasFeature = useCallback((featureName) => {
    return features[featureName] ?? false;
  }, [features]);

  // Check custom location limit
  const canAddLocation = useCallback((currentCount) => {
    return currentCount < features.customLocations;
  }, [features]);

  return {
    subscription,
    tier,
    features,
    loading,
    error,
    isPremium,
    isPro,
    isAuthenticated,
    hasFeature,
    canAddLocation,
    refresh: fetchSubscription
  };
}

/**
 * Simple hook just to check premium status
 * Use this when you just need to know if user has premium
 */
export function useIsPremium() {
  const { isPremium, loading } = useSubscription();
  return { isPremium, loading };
}

export default useSubscription;
