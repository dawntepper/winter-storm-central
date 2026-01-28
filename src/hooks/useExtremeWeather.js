/**
 * useExtremeWeather Hook
 * Manages state for extreme weather alerts with caching and auto-refresh
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchExtremeWeather, ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

export function useExtremeWeather(enabled = true) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);

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

  // Auto-refresh every 30 minutes
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      fetchAlerts(true); // Force refresh
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [enabled, fetchAlerts]);

  // Refresh when tab becomes visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && lastUpdated) {
        const age = Date.now() - lastUpdated.getTime();
        if (age > REFRESH_INTERVAL) {
          console.log('Tab visible, refreshing alerts...');
          fetchAlerts(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, lastUpdated, fetchAlerts]);

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
