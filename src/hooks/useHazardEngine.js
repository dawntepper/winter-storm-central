/**
 * useHazardEngine — client hook that builds a Hazard Engine snapshot
 * from live NWS alerts + cached Weather Brief.
 */

import { useEffect, useMemo, useState } from 'react';
import { hazardEngine } from '../../shared/hazard-engine/index.js';
import { useExtremeWeather } from './useExtremeWeather';

const BRIEF_API = '/.netlify/functions/hazard-weather-brief';

export function useHazardEngine(hazardSlug) {
  const {
    alerts: alertsData,
    loading: alertsLoading,
    error: alertsError,
    lastUpdated,
  } = useExtremeWeather();
  const [serverSnapshot, setServerSnapshot] = useState(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefError, setBriefError] = useState(null);

  const allAlerts = alertsData?.allAlerts || [];
  const dataAvailable = !alertsError || allAlerts.length > 0;

  const relatedCounts = useMemo(
    () => hazardEngine.getRelatedCounts(allAlerts),
    [allAlerts]
  );

  const localSnapshot = useMemo(() => {
    if (!hazardSlug) return null;
    const feedReady = !alertsLoading || allAlerts.length > 0 || Boolean(alertsError);
    return hazardEngine.get(hazardSlug, allAlerts, {
      cachedBrief: serverSnapshot?._cachedBrief || null,
      relatedCounts,
      latestSourceUpdateAt: lastUpdated
        ? new Date(lastUpdated).toISOString()
        : serverSnapshot?.latestSourceUpdateAt || null,
      // While the first fetch is in flight, avoid a false "zero active" flash
      dataAvailable: feedReady ? dataAvailable : true,
      // Soft-loading: treat as unavailable for count display until first result
      ...(alertsLoading && allAlerts.length === 0 && !alertsError
        ? {
          // Keep structure but mark freshness so UI can show checking state
        }
        : {}),
    });
  }, [
    hazardSlug,
    allAlerts,
    relatedCounts,
    lastUpdated,
    serverSnapshot,
    alertsLoading,
    dataAvailable,
    alertsError,
  ]);

  const snapshot = useMemo(() => {
    if (!localSnapshot?.ok) return localSnapshot;
    if (!serverSnapshot?.ok) return localSnapshot;

    return {
      ...localSnapshot,
      weatherBrief: serverSnapshot.weatherBrief || localSnapshot.weatherBrief,
      confidence: serverSnapshot.confidence || localSnapshot.confidence,
      freshness: {
        ...localSnapshot.freshness,
        briefGeneratedAt:
          serverSnapshot.weatherBrief?.generatedAt
          || localSnapshot.freshness.briefGeneratedAt,
      },
    };
  }, [localSnapshot, serverSnapshot]);

  useEffect(() => {
    if (!hazardSlug) return undefined;
    let cancelled = false;

    async function load() {
      setBriefLoading(true);
      setBriefError(null);
      try {
        const res = await fetch(
          `${BRIEF_API}?hazard=${encodeURIComponent(hazardSlug)}&skipGenerate=1`
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setBriefError(json.error || 'brief_unavailable');
          setServerSnapshot(null);
        } else {
          const briefSource = json.weatherBrief?.source;
          setServerSnapshot({
            ...json,
            _cachedBrief:
              briefSource === 'cached' || briefSource === 'manual'
                ? {
                  summary: json.weatherBrief.summary,
                  notable_change: json.weatherBrief.notableChange,
                  manual_override: briefSource === 'manual',
                  manual_summary:
                    briefSource === 'manual' ? json.weatherBrief.summary : null,
                  status: json.weatherBrief.status,
                  generated_at: json.weatherBrief.generatedAt,
                  model: json.weatherBrief.model,
                  prompt_version: json.weatherBrief.promptVersion,
                  active_count: json.activeCount,
                  affected_state_codes: (json.affectedStates || []).map((s) => s.code),
                  data_signature: json.dataSignature,
                }
                : null,
          });

          if (json.regeneration?.shouldRegenerate && briefSource !== 'manual') {
            fetch(`${BRIEF_API}?hazard=${encodeURIComponent(hazardSlug)}`).catch(() => {});
          }
        }
      } catch (err) {
        if (!cancelled) {
          setBriefError(err.message);
          setServerSnapshot(null);
        }
      } finally {
        if (!cancelled) setBriefLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [hazardSlug]);

  return {
    snapshot,
    loading: alertsLoading && allAlerts.length === 0 && !alertsError,
    briefLoading,
    briefError,
    alertsError,
    lastUpdated,
    allAlerts,
  };
}

export default useHazardEngine;
