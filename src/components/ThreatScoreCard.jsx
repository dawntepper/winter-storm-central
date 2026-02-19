import { useMemo, useState } from 'react';
import { calculateThreatScore, getScoreColor } from '../utils/threatScore';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../../shared/nws-alert-parser';

/**
 * Extract unique 2-letter state codes from user location names like "Birmingham, AL"
 */
function getStatesFromLocations(locations) {
  const states = new Set();
  for (const loc of locations) {
    if (!loc.name) continue;
    const match = loc.name.match(/,\s*([A-Z]{2})$/);
    if (match) states.add(match[1]);
  }
  return [...states].sort();
}

const BREAKDOWN_LABELS = {
  volume: { label: 'Alert Volume', desc: 'Number of active alerts' },
  severity: { label: 'Severity', desc: 'Avg severity level' },
  urgency: { label: 'Urgency', desc: 'Avg urgency level' },
  diversity: { label: 'Spread', desc: 'Category diversity' },
};

export default function ThreatScoreCard({ alerts, loading, filter, onFilterChange, userLocations }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const locationStates = useMemo(
    () => getStatesFromLocations(userLocations || []),
    [userLocations]
  );

  const { score, level, breakdown, categoryCounts, filteredCount, totalCount } = useMemo(() => {
    const total = alerts?.allAlerts?.length || 0;
    let allAlerts = alerts?.allAlerts || [];

    if (filter) {
      allAlerts = allAlerts.filter((a) => a.state === filter);
    }

    const result = calculateThreatScore(allAlerts);

    const counts = {};
    for (const alert of allAlerts) {
      if (alert.category) {
        counts[alert.category] = (counts[alert.category] || 0) + 1;
      }
    }

    return { ...result, categoryCounts: counts, filteredCount: allAlerts.length, totalCount: total };
  }, [alerts, filter]);

  const color = getScoreColor(score);
  const scopeLabel = filter ? `${filter} Weather Risk Index` : 'Weather Risk Index';

  if (loading && !alerts) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="h-1.5 bg-slate-700" />
        <div className="p-4 space-y-3">
          <div className="h-4 w-32 bg-slate-700 rounded animate-pulse mx-auto" />
          <div className="h-14 w-20 bg-slate-700 rounded animate-pulse mx-auto" />
          <div className="h-4 w-24 bg-slate-700 rounded animate-pulse mx-auto" />
          <div className="flex gap-2 justify-center">
            <div className="h-6 w-16 bg-slate-700 rounded animate-pulse" />
            <div className="h-6 w-16 bg-slate-700 rounded animate-pulse" />
            <div className="h-6 w-16 bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1.5 bg-slate-700 relative">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #22c55e, ${color})`,
          }}
        />
      </div>

      <div className="p-4 text-center">
        {/* Header */}
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
          {scopeLabel}
        </div>

        {/* Filter toggle */}
        {locationStates.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mb-3">
            <button
              onClick={() => onFilterChange?.(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                !filter
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:text-slate-300'
              }`}
            >
              US
            </button>
            {locationStates.map((st) => (
              <button
                key={st}
                onClick={() => onFilterChange?.(filter === st ? null : st)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filter === st
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Score */}
        <div className="text-5xl font-black leading-none" style={{ color }}>
          {score}
        </div>

        {/* Level label + alert count */}
        <div className="text-sm uppercase tracking-wider font-semibold mt-1" style={{ color }}>
          {level}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {filteredCount} active alert{filteredCount !== 1 ? 's' : ''}
          {filter && totalCount > 0 && (
            <span> of {totalCount} nationwide</span>
          )}
        </div>

        {/* Category breakdown */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-3">
            {CATEGORY_ORDER.filter((id) => categoryCounts[id]).map((id) => {
              const cat = ALERT_CATEGORIES[id];
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: cat.color + '20',
                    color: cat.color,
                    border: `1px solid ${cat.color}40`,
                  }}
                >
                  {cat.icon} {categoryCounts[id]}
                </span>
              );
            })}
          </div>
        )}

        {/* Expandable breakdown */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-[10px] text-slate-500 hover:text-slate-400 mt-2 cursor-pointer transition-colors"
        >
          {showBreakdown ? 'Hide details' : 'How is this calculated?'}
        </button>

        {showBreakdown && (
          <div className="mt-2 space-y-1.5 text-left">
            {Object.entries(breakdown).map(([key, value]) => {
              const meta = BREAKDOWN_LABELS[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-400">{meta.label}</span>
                    <span className="text-slate-500">{value}/25</span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(value / 25) * 100}%`,
                        backgroundColor: getScoreColor((value / 25) * 100),
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-slate-600 mt-1 text-center">
              Score = volume + severity + urgency + spread (each 0-25)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
