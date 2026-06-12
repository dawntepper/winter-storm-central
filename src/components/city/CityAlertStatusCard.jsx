import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function severityTone(severity) {
  if (severity === 'Extreme') return 'border-red-500/50 bg-red-500/10 text-red-200';
  if (severity === 'Severe') return 'border-orange-500/50 bg-orange-500/10 text-orange-200';
  if (severity === 'Moderate') return 'border-amber-500/50 bg-amber-500/10 text-amber-200';
  return 'border-sky-500/50 bg-sky-500/10 text-sky-200';
}

function formatUpdatedTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return null;
  }
}

/**
 * Alert status summary — prominent card when alerts are active, compact pill when all clear.
 */
export default function CityAlertStatusCard({
  cityName,
  alerts,
  loading = false,
  error = false,
  lastUpdated,
  compact = false,
  lat,
  lon,
}) {
  const updatedLabel = formatUpdatedTime(lastUpdated);

  if (compact) {
    if (error) {
      return (
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-amber-200">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/40 bg-amber-500/10">
            Alert feed unavailable
          </span>
          {Number.isFinite(lat) && Number.isFinite(lon) ? (
            <a
              className="text-sky-400 hover:text-sky-300 underline text-xs"
              href={`https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Check weather.gov
            </a>
          ) : null}
        </p>
      );
    }

    if (loading || alerts === null) {
      return (
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-600 bg-slate-800/60 text-sm text-slate-400">
          Checking NWS alerts for {cityName}…
        </p>
      );
    }

    if (alerts.length === 0) {
      return (
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-200">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 font-medium">
            <span aria-hidden="true">✓</span>
            No active alerts
          </span>
          {updatedLabel && (
            <span className="text-xs text-slate-500">NWS updated {updatedLabel}</span>
          )}
        </p>
      );
    }

    const count = alerts.length;
    const topAlert = alerts[0];
    const topCategory = topAlert ? ALERT_CATEGORIES[topAlert.category] : null;

    return (
      <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium ${severityTone(topAlert?.severity)}`}>
          {topCategory && <span aria-hidden="true">{topCategory.icon}</span>}
          {count} active alert{count === 1 ? '' : 's'}
        </span>
        {topAlert && (
          <span className="text-slate-300 text-xs sm:text-sm truncate max-w-[min(100%,20rem)]">
            {topAlert.event}
            {count > 1 && ` (+${count - 1} more)`}
          </span>
        )}
        {updatedLabel && (
          <span className="text-xs text-slate-500">NWS updated {updatedLabel}</span>
        )}
      </p>
    );
  }

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
              + {count - 1} more — view full NWS text below
            </p>
          )}
        </>
      )}

      {updatedLabel && (
        <p className="text-[10px] mt-auto pt-4 opacity-60">
          NWS feed updated {updatedLabel}
        </p>
      )}
    </div>
  );
}
