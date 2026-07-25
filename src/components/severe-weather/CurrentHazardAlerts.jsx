import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LiveAlertCard from '../LiveAlertCard';
import { rankAlerts } from '../../utils/alertRanking';

const INITIAL_VISIBLE = 8;

export default function CurrentHazardAlerts({ hazard, onAlertOpen }) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [tick] = useState(0);

  const ranked = useMemo(
    () => rankAlerts(hazard.alerts || []),
    [hazard.alerts]
  );

  const shown = ranked.slice(0, visible);

  return (
    <section id="current-alerts" aria-labelledby="current-alerts-heading" className="mt-10">
      <h2 id="current-alerts-heading" className="text-lg font-semibold text-white mb-1">
        Current {hazard.pluralLabel}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        {hazard.freshness?.latestSourceUpdateAt
          ? `Alert list refreshed ${new Date(hazard.freshness.latestSourceUpdateAt).toLocaleString()}`
          : 'Live National Weather Service alerts'}
      </p>

      {ranked.length === 0 ? (
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-4 py-5">
          <p className="text-sm text-slate-300">
            No active {hazard.pluralLabel?.toLowerCase()} right now.
          </p>
          {hazard.relatedHazards?.length > 0 && (
            <p className="mt-2 text-sm text-slate-400">
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
      ) : (
        <>
          <div className="space-y-3">
            {shown.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onAlertOpen?.(alert)}
                onKeyDown={undefined}
              >
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
              Show more warnings ({ranked.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}
