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

function AlertTextCard({ alert, isPrimary = false }) {
  const [open, setOpen] = useState(false);
  const category = ALERT_CATEGORIES[alert.category];
  const hasBody = Boolean(alert.description || alert.instruction);

  return (
    <article className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {category && (
              <span className="text-sm" aria-hidden="true">{category.icon}</span>
            )}
            <h3 className="text-sm font-semibold text-white">{alert.event}</h3>
            {isPrimary && (
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Primary</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
            {alert.effective && <span>Effective {formatDateTime(alert.effective)}</span>}
            {alert.expires && <span>Expires {formatDateTime(alert.expires)}</span>}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${severityClasses(alert.severity)} whitespace-nowrap`}>
          {alert.severity || 'Alert'}
        </span>
      </div>

      {hasBody && (
        <div className="px-4 pb-3 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-3 text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
            aria-expanded={open}
          >
            {open ? 'Hide full NWS message' : 'View full NWS message'} {open ? '▴' : '▾'}
          </button>
          {open && (
            <div className="mt-3 space-y-3 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {alert.areaDesc && (
                <p className="text-xs text-slate-400">
                  <span className="text-slate-500">Affected:</span> {alert.areaDesc}
                </p>
              )}
              {alert.headline && (
                <p className="text-sm text-slate-300 font-medium">{alert.headline}</p>
              )}
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
 * Collapsed full NWS alert text — secondary to the top Active Alert Summary.
 */
export default function CityAlertsSection({
  cityName,
  alerts,
  loading = false,
  error = false,
  lat,
  lon,
}) {
  const [sectionOpen, setSectionOpen] = useState(false);

  if (error) {
    return (
      <section aria-label="Full NWS alert text">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Full NWS Alert Text
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
      <section aria-label="Full NWS alert text">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Full NWS Alert Text
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
    <section aria-label="Full NWS alert text">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Full NWS Alert Text
          {alerts.length > 1 && (
            <span className="text-slate-500 font-normal normal-case tracking-normal ml-1.5">
              ({alerts.length} alerts)
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          aria-expanded={sectionOpen}
        >
          {sectionOpen ? 'Hide full NWS message' : 'View full NWS message'} {sectionOpen ? '▴' : '▾'}
        </button>
      </div>
      {sectionOpen && (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <AlertTextCard key={alert.id} alert={alert} isPrimary={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
