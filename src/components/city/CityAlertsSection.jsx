import { useState } from 'react';
import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function severityClasses(severity) {
  if (severity === 'Extreme') return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (severity === 'Severe') return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (severity === 'Moderate') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (severity === 'Minor') return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
}

function AlertCard({ alert }) {
  const [open, setOpen] = useState(false);
  const category = ALERT_CATEGORIES[alert.category];

  return (
    <article className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {category && (
                <span className="text-base" aria-hidden="true">{category.icon}</span>
              )}
              <h3 className="text-base font-semibold text-white">{alert.event}</h3>
            </div>
            {alert.headline && (
              <p className="text-sm text-slate-300 leading-snug">{alert.headline}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${severityClasses(alert.severity)} whitespace-nowrap`}>
            {alert.severity || 'Alert'}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
          {alert.effective && <span>Effective: {formatDateTime(alert.effective)}</span>}
          {alert.expires && <span>Expires: {formatDateTime(alert.expires)}</span>}
        </div>
      </header>

      {alert.areaDesc && (
        <div className="px-4 py-2 text-xs text-slate-400 bg-slate-900/40 border-b border-slate-700/60">
          <span className="text-slate-500">Affected:</span> {alert.areaDesc}
        </div>
      )}

      {(alert.description || alert.instruction) && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            {open ? 'Hide details' : 'Show full NWS message'} {open ? '▴' : '▾'}
          </button>
          {open && (
            <div className="mt-3 space-y-3 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {alert.description && <p>{alert.description}</p>}
              {alert.instruction && (
                <p className="border-l-2 border-amber-500/50 pl-3 text-amber-100">
                  {alert.instruction}
                </p>
              )}
              {alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-sky-400 hover:underline"
                >
                  View on weather.gov &rarr;
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Active NWS alerts list — shared by static and catalog city pages.
 */
export default function CityAlertsSection({
  cityName,
  alerts,
  loading = false,
  error = false,
  lat,
  lon,
  signupHint = false,
}) {
  if (error) {
    return (
      <section aria-label="Active weather alerts">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Active Alerts
        </h2>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-200">
          NWS alert data is temporarily unavailable. Please refresh, or check{' '}
          {Number.isFinite(lat) && Number.isFinite(lon) ? (
            <a
              className="underline"
              href={`https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              weather.gov directly
            </a>
          ) : (
            <a className="underline" href="https://weather.gov" target="_blank" rel="noopener noreferrer">
              weather.gov directly
            </a>
          )}
          .
        </div>
      </section>
    );
  }

  if (loading || alerts === null) {
    return (
      <section aria-label="Active weather alerts">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Active Alerts
        </h2>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm">Loading alerts for {cityName}…</p>
        </div>
      </section>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <section aria-label="Active weather alerts">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Active Alerts ({alerts.length})
      </h2>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  );
}
