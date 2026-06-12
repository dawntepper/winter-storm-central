import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function severityTone(severity) {
  if (severity === 'Extreme') return 'border-red-500/50 bg-red-500/10 text-red-200';
  if (severity === 'Severe') return 'border-orange-500/50 bg-orange-500/10 text-orange-200';
  if (severity === 'Moderate') return 'border-amber-500/50 bg-amber-500/10 text-amber-200';
  return 'border-sky-500/50 bg-sky-500/10 text-sky-200';
}

/**
 * Alert status summary card — left column of the city dashboard top row.
 */
export default function CityAlertStatusCard({
  cityName,
  alerts,
  loading = false,
  error = false,
  lastUpdated,
}) {
  if (error) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 h-full flex flex-col">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Alert Status
        </h2>
        <p className="text-sm text-amber-200">Alert feed temporarily unavailable.</p>
      </div>
    );
  }

  if (loading || alerts === null) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 h-full flex flex-col">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Alert Status
        </h2>
        <p className="text-sm text-slate-400">Checking NWS alerts for {cityName}…</p>
      </div>
    );
  }

  const count = alerts.length;
  const topAlert = alerts[0];
  const topCategory = topAlert ? ALERT_CATEGORIES[topAlert.category] : null;

  return (
    <div className={`border rounded-xl p-5 h-full flex flex-col ${
      count > 0 ? severityTone(topAlert?.severity) : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
    }`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide mb-3 opacity-80">
        Alert Status · {cityName}
      </h2>

      {count === 0 ? (
        <>
          <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            All clear
          </p>
          <p className="text-sm mt-2 opacity-90">
            No active NWS warnings or watches for this area right now.
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {count} active alert{count === 1 ? '' : 's'}
          </p>
          {topAlert && (
            <p className="text-sm mt-2 flex items-center gap-2">
              {topCategory && <span aria-hidden="true">{topCategory.icon}</span>}
              <span>{topAlert.event}</span>
              {topAlert.severity && (
                <span className="text-xs font-semibold opacity-80">({topAlert.severity})</span>
              )}
            </p>
          )}
          {count > 1 && (
            <p className="text-xs mt-2 opacity-75">
              + {count - 1} more — see details below
            </p>
          )}
        </>
      )}

      {lastUpdated && (
        <p className="text-[10px] mt-auto pt-4 opacity-60">
          NWS feed updated {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
