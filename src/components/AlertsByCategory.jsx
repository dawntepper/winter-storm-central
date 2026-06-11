import { useMemo, useState } from 'react';
import { useMinuteTick } from '../hooks/useMinuteTick';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';
import { formatExpirationBadge } from '../utils/expirationBadge';
import { trackStateAlertDetailView } from '../utils/analytics';

const CATEGORY_COLORS = {
  tornado:  { bg: '#5c1414', border: '#dc2626', text: 'antiquewhite' },
  tropical: { bg: '#1e3a8a', border: '#6366f1', text: 'antiquewhite' },
  severe:   { bg: '#4a3f1f', border: '#f97316', text: 'antiquewhite' },
  winter:   { bg: '#1e3a5f', border: '#3b82f6', text: 'antiquewhite' },
  flood:    { bg: '#164e63', border: '#06b6d4', text: 'antiquewhite' },
  heat:     { bg: '#7c2d12', border: '#ef4444', text: 'antiquewhite' },
  fire:     { bg: '#78350f', border: '#d97706', text: 'antiquewhite' },
  default:  { bg: '#334155', border: '#64748b', text: 'antiquewhite' },
};

/**
 * Collapsible alert list grouped by NWS category.
 */
export default function AlertsByCategory({ alerts, stateCode, onViewDetail, listMaxHeight }) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const nowMs = useMinuteTick();

  const grouped = useMemo(() => {
    const groups = {};
    for (const alert of alerts) {
      const cat = alert.category || 'severe';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(alert);
    }
    return groups;
  }, [alerts]);

  const toggleCategory = (catId) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: prev[catId] === true ? false : true }));
  };

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map((categoryId) => {
        const categoryAlerts = grouped[categoryId];
        if (!categoryAlerts || categoryAlerts.length === 0) return null;

        const category = ALERT_CATEGORIES[categoryId];
        const colors = CATEGORY_COLORS[categoryId] || CATEGORY_COLORS.default;
        const isExpanded = expandedCategories[categoryId] === true;

        return (
          <div key={categoryId} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
            <button
              onClick={() => toggleCategory(categoryId)}
              className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:brightness-110 transition-all"
              style={{ backgroundColor: colors.bg }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{category.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
                  {category.name}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.border, color: colors.text }}
                >
                  {categoryAlerts.length}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div
                className="bg-slate-800 overflow-y-auto"
                style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
              >
                {categoryAlerts.map((alert, idx) => (
                  <button
                    key={alert.id || idx}
                    onClick={() => {
                      if (stateCode) {
                        trackStateAlertDetailView({ stateCode, alertType: alert.event });
                      }
                      onViewDetail(alert);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-700/50 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{alert.event}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.location}</p>
                        {alert.headline && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.headline}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            alert.severity === 'Extreme'
                              ? 'bg-red-500/20 text-red-400'
                              : alert.severity === 'Severe'
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        {alert.expires &&
                          (() => {
                            const { label, urgency } = formatExpirationBadge(alert.expires, nowMs);
                            if (!label) return null;
                            const tone =
                              urgency === 'urgent'
                                ? 'text-red-400 font-semibold'
                                : urgency === 'expired'
                                  ? 'text-slate-600'
                                  : 'text-slate-500';
                            return (
                              <span className={`text-[10px] ${tone}`}>Exp: {label}</span>
                            );
                          })()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
