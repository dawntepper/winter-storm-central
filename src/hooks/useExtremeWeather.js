/**
 * useExtremeWeather Hook
 * Manages state for extreme weather alerts with caching + adaptive polling.
 *
 * Polling cadence flips based on what's in the current alert payload:
 *   - Tornado Warning or Flash Flood Warning present anywhere in CONUS
 *     → REFRESH_INTERVAL_FAST (2 min)
 *   - Otherwise → REFRESH_INTERVAL_NORMAL (10 min)
 *
 * The swap is invisible to users — no banner, no admin toggle. The system
 * just feels more responsive during active severe weather. Cache TTL in
 * noaaAlertsService mirrors the same rule so a faster poll isn't swallowed
 * by stale localStorage data.
 *
 * Email pipeline (netlify/functions/process-weather-alerts-background.js)
 * is unaffected — it still runs every 30 min via Netlify cron.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchExtremeWeather,
  hasUrgentAlert,
  REFRESH_INTERVAL_NORMAL,
  REFRESH_INTERVAL_FAST,
  ALERT_CATEGORIES,
  CATEGORY_ORDER,
} from '../services/noaaAlertsService';

export function useExtremeWeather(enabled = true) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);

  // Track the active polling interval so we only swap setInterval when the
  // mode actually changes — not on every fetch tick.
  const intervalRef = useRef({ id: null, ms: null });

  const fetchAlerts = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchExtremeWeather(forceRefresh);

      setAlerts(result);
      setLastUpdated(new Date(result.lastUpdated));
      setIsStale(result.stale || false);

      if (result.error) {
        setError(result.error);
      }

    } catch (err) {
      console.error('useExtremeWeather error:', err);
      setError(err.message || 'Failed to fetch weather alerts');
      // Intentionally leave the active interval untouched on fetch failure —
      // retry happens on the next tick at the existing cadence.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchAlerts();
    }
  }, [enabled, fetchAlerts]);

  // Adaptive auto-refresh. Re-runs when alerts changes, but the inner check
  // skips the clearInterval/setInterval round-trip if the desired cadence
  // is already active — meaning steady-state quiet/active periods don't
  // churn timers, only the boundary transitions do.
  useEffect(() => {
    if (!enabled) {
      // Disabling tears down the interval entirely.
      if (intervalRef.current.id !== null) {
        clearInterval(intervalRef.current.id);
        intervalRef.current = { id: null, ms: null };
      }
      return;
    }

    const desiredMs = hasUrgentAlert(alerts?.allAlerts)
      ? REFRESH_INTERVAL_FAST
      : REFRESH_INTERVAL_NORMAL;

    if (intervalRef.current.ms !== desiredMs) {
      if (intervalRef.current.id !== null) {
        clearInterval(intervalRef.current.id);
      }
      intervalRef.current = {
        id: setInterval(() => fetchAlerts(true), desiredMs),
        ms: desiredMs,
      };
    }

    return () => {
      // Cleanup runs on unmount or before the next effect; we let the
      // next effect re-arm if needed, so only fully tear down here.
      // (Without this, every alerts update would clear+recreate.)
    };
  }, [alerts, enabled, fetchAlerts]);

  // Tear down the interval on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current.id !== null) {
        clearInterval(intervalRef.current.id);
        intervalRef.current = { id: null, ms: null };
      }
    };
  }, []);

  // Refresh when tab becomes visible AND data is older than the current
  // cache TTL. Threshold matches the active cadence so a returning user
  // during fast mode gets fresh data after just 2 min idle.
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lastUpdated) {
        const age = Date.now() - lastUpdated.getTime();
        const threshold = hasUrgentAlert(alerts?.allAlerts)
          ? REFRESH_INTERVAL_FAST
          : REFRESH_INTERVAL_NORMAL;
        if (age > threshold) {
          console.log('Tab visible, refreshing alerts...');
          fetchAlerts(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, lastUpdated, alerts, fetchAlerts]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchAlerts(true);
  }, [fetchAlerts]);

  // Get alerts by category (only categories with alerts)
  const getAlertsByCategory = useCallback(() => {
    if (!alerts?.byCategory) return [];

    return CATEGORY_ORDER
      .filter(categoryId => alerts.byCategory[categoryId]?.length > 0)
      .map(categoryId => ({
        ...ALERT_CATEGORIES[categoryId],
        alerts: alerts.byCategory[categoryId].slice(0, 10), // Show up to 10 per category in flat list
        allAlerts: alerts.byCategory[categoryId], // All alerts for state grouping
        totalCount: alerts.byCategory[categoryId].length // Actual count for badge
      }));
  }, [alerts]);

  // Check if there are any active alerts
  const hasActiveAlerts = alerts?.totalCount > 0;

  return {
    alerts,
    loading,
    error,
    lastUpdated,
    isStale,
    refresh,
    getAlertsByCategory,
    hasActiveAlerts,
    categories: ALERT_CATEGORIES,
    categoryOrder: CATEGORY_ORDER
  };
}

export default useExtremeWeather;
