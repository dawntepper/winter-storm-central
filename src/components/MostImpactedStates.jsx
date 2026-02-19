import { useMemo } from 'react';
import { STATE_NAMES } from '../data/stateConfig';
import { ALERT_CATEGORIES } from '../../shared/nws-alert-parser';

const TOP_N = 5;

export default function MostImpactedStates({ alerts, loading, onStateZoom }) {
  const states = useMemo(() => {
    const allAlerts = alerts?.allAlerts || [];
    if (allAlerts.length === 0) return [];

    // Count alerts per state and track category breakdown
    const stateCounts = {};
    for (const a of allAlerts) {
      if (!a.state) continue;
      if (!stateCounts[a.state]) {
        stateCounts[a.state] = { total: 0, categories: {} };
      }
      stateCounts[a.state].total++;
      stateCounts[a.state].categories[a.category] =
        (stateCounts[a.state].categories[a.category] || 0) + 1;
    }

    // Sort by count, take top N
    const sorted = Object.entries(stateCounts)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, TOP_N);

    const maxCount = sorted[0]?.[1].total || 1;

    return sorted.map(([abbr, data]) => {
      // Find dominant category
      const topCat = Object.entries(data.categories).sort(([, a], [, b]) => b - a)[0];
      const catInfo = topCat ? ALERT_CATEGORIES[topCat[0]] : null;

      return {
        abbr,
        name: STATE_NAMES[abbr] || abbr,
        count: data.total,
        pct: (data.total / maxCount) * 100,
        topCategory: catInfo,
        categories: data.categories,
      };
    });
  }, [alerts]);

  if (loading && !alerts) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 border-l-4 border-l-amber-500 p-4">
        <div className="h-5 w-36 bg-slate-700 rounded animate-pulse mb-3" />
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-8 bg-slate-700 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (states.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 border-l-4 border-l-amber-500 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Most Impacted States</h3>
        <p className="text-xs text-slate-500 text-center py-3">No active alerts</p>
      </div>
    );
  }

  return (
    <div id="top-states" className="bg-slate-800/50 rounded-xl border border-slate-700 border-l-4 border-l-amber-500 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Most Impacted States</h3>

      <div className="space-y-2">
        {states.map((st, i) => (
          <button
            key={st.abbr}
            onClick={() => onStateZoom?.(st.abbr)}
            className="group w-full flex items-center gap-2 hover:bg-slate-700/30 rounded px-1 -mx-1 py-0.5 transition-colors cursor-pointer text-left"
          >
            {/* Rank */}
            <span className="text-[10px] text-slate-600 w-3 text-right font-mono">{i + 1}</span>

            {/* State abbr + category icons */}
            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors flex items-center gap-1">
              <span className="w-7">{st.abbr}</span>
              {Object.entries(st.categories)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([catId]) => {
                  const cat = ALERT_CATEGORIES[catId];
                  return cat ? (
                    <span key={catId} className="text-[8px] leading-none">{cat.icon}</span>
                  ) : null;
                })}
            </span>

            {/* Bar */}
            <div className="flex-1 h-4 bg-slate-700/40 rounded-sm overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all"
                style={{
                  width: `${st.pct}%`,
                  backgroundColor: st.topCategory?.color || '#64748b',
                  opacity: 0.7,
                }}
              />
            </div>

            {/* Count */}
            <span className="text-xs text-slate-400 w-7 text-right tabular-nums">
              {st.count}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
