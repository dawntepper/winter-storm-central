import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { rankAlerts } from '../utils/alertRanking';
import LiveAlertCard from './LiveAlertCard';

const MAX_DISPLAY = 6;

/**
 * LiveAlertsWidget — Dashboard widget showing top ranked alerts.
 * Follows the MostImpactedStates container pattern.
 *
 * Props:
 *   alerts   — alertsData from useExtremeWeather (has .allAlerts)
 *   loading  — boolean
 */
export default function LiveAlertsWidget({ alerts, loading, onAlertTap, onAddToMap }) {
  const [tick, setTick] = useState(0);

  // 60-second tick to keep time-remaining fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const ranked = rankAlerts(alerts?.allAlerts || []).slice(0, MAX_DISPLAY);

  // Loading skeleton
  if (loading && !alerts) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
          <div className="h-4 w-24 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 bg-slate-700 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-slate-700 rounded animate-pulse" />
              <div className="h-3 w-10 bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (ranked.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-red-400">Live Alerts</h3>
          <Link to="/alerts" className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors">View All &rarr;</Link>
        </div>
        <p className="text-xs text-slate-500 text-center py-4">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-red-400">Live Alerts</h3>
        <Link to="/alerts" className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors">View All &rarr;</Link>
      </div>

      {/* Alert list */}
      <div className="divide-y divide-slate-700/50">
        {ranked.map((alert) => (
          <LiveAlertCard key={alert.id} alert={alert} mode="compact" tick={tick} onAlertTap={onAlertTap} onAddToMap={onAddToMap} />
        ))}
      </div>
    </div>
  );
}
