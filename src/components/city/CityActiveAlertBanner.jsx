import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function chipTone(severity) {
  if (severity === 'Extreme') return 'border-red-500/50 bg-red-500/15 text-red-200';
  if (severity === 'Severe') return 'border-orange-500/50 bg-orange-500/15 text-orange-200';
  if (severity === 'Moderate') return 'border-amber-500/50 bg-amber-500/15 text-amber-200';
  return 'border-sky-500/50 bg-sky-500/15 text-sky-200';
}

/**
 * Compact alert chips shown under hero when NWS alerts are active — safety signal before radar.
 */
export default function CityActiveAlertBanner({ alerts, loading = false }) {
  if (loading || !alerts || alerts.length === 0) return null;

  const shown = alerts.slice(0, 3);
  const remaining = alerts.length - shown.length;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="status"
      aria-live="polite"
    >
      {shown.map((alert) => {
        const category = ALERT_CATEGORIES[alert.category];
        return (
          <a
            key={alert.id}
            href="#city-active-alerts"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors hover:brightness-110 ${chipTone(alert.severity)}`}
          >
            {category && <span aria-hidden="true">{category.icon}</span>}
            <span>{alert.event}</span>
          </a>
        );
      })}
      {remaining > 0 && (
        <a
          href="#city-active-alerts"
          className="text-xs text-slate-400 hover:text-slate-300 underline"
        >
          +{remaining} more
        </a>
      )}
    </div>
  );
}
