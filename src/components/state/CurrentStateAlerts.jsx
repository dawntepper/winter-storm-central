import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LiveAlertCard from '../LiveAlertCard';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../../../shared/nws-alert-parser';
import { trackStateAlertDetailView, trackStateHazardClicked } from '../../utils/analytics';

/** Show all alerts in a category at or below this count; otherwise paginate. */
const CATEGORY_EXPAND_THRESHOLD = 8;
const CATEGORY_INITIAL_VISIBLE = 6;

/**
 * Current state alerts grouped by hazard category.
 * Reuses LiveAlertCard (same card system as hazard / live alert pages).
 */
export default function CurrentStateAlerts({
  stateName,
  stateCode,
  alerts = [],
  hazards = [],
  activeCategories = null,
  onAlertOpen,
}) {
  const [expandedCats, setExpandedCats] = useState({});
  const [tick] = useState(0);

  const filterActive = activeCategories instanceof Set
    && activeCategories.size > 0
    && activeCategories.size < CATEGORY_ORDER.length;

  const selectedCategory = filterActive && activeCategories.size === 1
    ? [...activeCategories][0]
    : null;

  const grouped = useMemo(() => {
    const groups = {};
    for (const alert of alerts) {
      const cat = alert.category;
      if (!cat) continue;
      if (filterActive && !activeCategories.has(cat)) continue;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(alert);
    }
    return groups;
  }, [alerts, filterActive, activeCategories]);

  const orderedCategories = useMemo(() => {
    const fromHazards = (hazards || []).map((h) => h.id);
    const ids = fromHazards.length
      ? fromHazards
      : CATEGORY_ORDER.filter((id) => grouped[id]?.length);
    return ids.filter((id) => grouped[id]?.length);
  }, [hazards, grouped]);

  const totalShown = orderedCategories.reduce(
    (sum, id) => sum + (grouped[id]?.length || 0),
    0
  );

  return (
    <section id="current-alerts" aria-labelledby="current-state-alerts-heading" className="mt-2">
      <h2 id="current-state-alerts-heading" className="text-lg font-semibold text-white mb-1">
        Current {stateName} Weather Alerts
        {alerts.length > 0 ? (
          <span className="text-slate-400 font-medium"> — {selectedCategory ? totalShown : alerts.length}</span>
        ) : null}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Active National Weather Service alerts for {stateName}
        {selectedCategory && ALERT_CATEGORIES[selectedCategory]
          ? ` · filtered to ${ALERT_CATEGORIES[selectedCategory].name}`
          : ''}
      </p>

      {alerts.length === 0 || orderedCategories.length === 0 ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-4 py-5">
          <p className="text-sm font-medium text-slate-200">
            {alerts.length === 0
              ? 'No active alerts right now.'
              : `No ${ALERT_CATEGORIES[selectedCategory]?.name || 'matching'} alerts in the current filter.`}
          </p>
          {alerts.length === 0 && (
            <p className="mt-1.5 text-sm text-slate-400">
              There are currently no active National Weather Service alerts for {stateName}.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {orderedCategories.map((categoryId) => {
            const category = ALERT_CATEGORIES[categoryId];
            const list = grouped[categoryId] || [];
            const hazardMeta = (hazards || []).find((h) => h.id === categoryId);
            const isExpanded = expandedCats[categoryId] === true;
            const needsPagination = list.length > CATEGORY_EXPAND_THRESHOLD;
            const visible = needsPagination && !isExpanded
              ? list.slice(0, CATEGORY_INITIAL_VISIBLE)
              : list;

            return (
              <div key={categoryId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-slate-200">
                    <span aria-hidden="true" className="mr-1.5">{category?.icon}</span>
                    {category?.name || categoryId}
                    <span className="text-slate-500 font-normal"> — {list.length}</span>
                  </h3>
                  {hazardMeta?.href && (
                    <Link
                      to={hazardMeta.href}
                      onClick={() =>
                        trackStateHazardClicked({
                          stateCode,
                          hazardSlug: hazardMeta.hazardPageSlug || hazardMeta.slug,
                          sourceSection: 'current_alerts_group',
                        })
                      }
                      className="text-xs text-sky-400 hover:underline"
                    >
                      National {hazardMeta.hazardPageLabel || hazardMeta.label} →
                    </Link>
                  )}
                </div>
                <div className="space-y-3">
                  {visible.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => {
                        trackStateAlertDetailView({
                          stateCode,
                          alertType: alert.event,
                          sourceSection: 'current_alerts',
                        });
                        onAlertOpen?.(alert);
                      }}
                    >
                      <LiveAlertCard alert={alert} mode="full" tick={tick} />
                    </div>
                  ))}
                </div>
                {needsPagination && !isExpanded && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCats((prev) => ({ ...prev, [categoryId]: true }))
                    }
                    className="mt-3 text-sm text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                  >
                    View all {list.length} {category?.name || 'alerts'} alerts
                  </button>
                )}
                {needsPagination && isExpanded && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCats((prev) => ({ ...prev, [categoryId]: false }))
                    }
                    className="mt-3 text-sm text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    Show fewer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
