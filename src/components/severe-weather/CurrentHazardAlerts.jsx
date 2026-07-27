import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LiveAlertCard from '../LiveAlertCard';
import { rankAlerts } from '../../utils/alertRanking';

const INITIAL_VISIBLE = 8;
const GROUP_BY_STATE_MIN_ALERTS = 4;
const GROUP_BY_STATE_MIN_STATES = 2;

export default function CurrentHazardAlerts({ hazard, loading = false, onAlertOpen }) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [tick] = useState(0);

  const ranked = useMemo(
    () => rankAlerts(hazard.alerts || []),
    [hazard.alerts]
  );

  const groupedByState = useMemo(() => {
    const states = hazard.affectedStates || [];
    if (
      ranked.length < GROUP_BY_STATE_MIN_ALERTS
      || states.length < GROUP_BY_STATE_MIN_STATES
    ) {
      return null;
    }

    const groups = new Map();
    for (const alert of ranked) {
      const code = alert.state || 'OTHER';
      if (!groups.has(code)) groups.set(code, []);
      groups.get(code).push(alert);
    }

    // Preserve affectedStates sort (count desc, then name)
    const ordered = [];
    for (const state of states) {
      const list = groups.get(state.code);
      if (list?.length) {
        ordered.push({ state, alerts: list });
        groups.delete(state.code);
      }
    }
    for (const [code, list] of groups) {
      ordered.push({
        state: { code, name: code === 'OTHER' ? 'Other areas' : code, href: null },
        alerts: list,
      });
    }
    return ordered;
  }, [ranked, hazard.affectedStates]);

  const flatShown = ranked.slice(0, visible);
  const plural = hazard.pluralLabel || 'Alerts';

  return (
    <section
      id="current-alerts"
      aria-labelledby="current-alerts-heading"
      aria-busy={loading || undefined}
      className="mt-10"
    >
      <h2 id="current-alerts-heading" className="text-lg font-semibold text-white mb-1">
        Current {plural}
        {!loading && ranked.length > 0 ? (
          <span className="text-slate-400 font-medium"> — {ranked.length}</span>
        ) : null}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        {loading
          ? 'Loading National Weather Service alerts…'
          : hazard.freshness?.latestSourceUpdateAt
            ? `Alert list refreshed ${new Date(hazard.freshness.latestSourceUpdateAt).toLocaleString()}`
            : 'Live National Weather Service alerts'}
      </p>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-4 py-4 space-y-2"
            >
              <div className="content-placeholder h-4 w-2/3" />
              <div className="content-placeholder h-3 w-1/3" />
              <div className="content-placeholder h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="content-appear">
          {ranked.length === 0 ? (
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-4 py-5">
              <p className="text-sm font-medium text-slate-200">
                No {plural} Active
              </p>
              <p className="mt-1.5 text-sm text-slate-400">
                There are currently no active {plural} in the United States.
              </p>
              {hazard.relatedHazards?.length > 0 && (
                <p className="mt-3 text-sm text-slate-400">
                  Related:{' '}
                  {hazard.relatedHazards.slice(0, 3).map((r, i) => (
                    <span key={r.slug}>
                      {i > 0 && ', '}
                      <Link to={r.href} className="text-sky-400 hover:underline">
                        {r.label}
                      </Link>
                      {typeof r.activeCount === 'number' && r.activeCount > 0
                        ? ` (${r.activeCount})`
                        : ''}
                    </span>
                  ))}
                </p>
              )}
            </div>
          ) : groupedByState ? (
            <div className="space-y-6">
              {groupedByState.map(({ state, alerts }) => (
                <div key={state.code}>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">
                    {state.href ? (
                      <Link to={state.href} className="text-sky-400 hover:underline">
                        {state.name}
                      </Link>
                    ) : (
                      state.name
                    )}
                    <span className="text-slate-500 font-normal"> — {alerts.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div key={alert.id} onClick={() => onAlertOpen?.(alert)}>
                        <LiveAlertCard alert={alert} mode="full" tick={tick} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {flatShown.map((alert) => (
                  <div key={alert.id} onClick={() => onAlertOpen?.(alert)}>
                    <LiveAlertCard alert={alert} mode="full" tick={tick} />
                  </div>
                ))}
              </div>
              {ranked.length > visible && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + INITIAL_VISIBLE)}
                  className="mt-4 text-sm text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Show more ({ranked.length - visible} remaining)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
