import { useMemo } from 'react';
import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function scrollToTarget(alertCount) {
  const targetId = alertCount > 0 ? 'city-active-alerts' : 'city-radar-section';
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (alertCount > 0) {
    const toggle = el.querySelector('[data-alert-section-toggle]');
    if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
      toggle.click();
    }
  }
}

/**
 * Alert status chip near the city page title — visible without scrolling.
 * Click scrolls to Active Alerts (or radar when all clear).
 */
export default function CityPageAlertStatus({
  alerts,
  loading = false,
  cityName,
  stateCode,
  onStatusClick,
}) {
  const alertCount = Array.isArray(alerts) ? alerts.length : 0;

  const uniqueTypes = useMemo(() => {
    if (!Array.isArray(alerts) || alerts.length === 0) return [];
    const seen = new Set();
    const types = [];
    for (const alert of alerts) {
      if (!alert?.event || seen.has(alert.event)) continue;
      seen.add(alert.event);
      const category = ALERT_CATEGORIES[alert.category];
      types.push({
        event: alert.event,
        icon: category?.icon || '⚠️',
      });
    }
    return types;
  }, [alerts]);

  const handleClick = () => {
    onStatusClick?.({ city: cityName, state: stateCode, alertCount });
    scrollToTarget(alertCount);
  };

  if (loading || alerts === null) {
    return (
      <p className="mt-2 text-sm text-slate-400" role="status" aria-live="polite">
        Checking NWS alerts for {cityName}…
      </p>
    );
  }

  const statusLabel = alertCount === 0
    ? '✅ No active alerts'
    : alertCount === 1
      ? '⚠️ 1 active alert'
      : `⚠️ ${alertCount} active alerts`;

  const toneClass = alertCount === 0
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
    : 'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15';

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors cursor-pointer ${toneClass}`}
        aria-label={alertCount > 0 ? `View ${alertCount} active alert${alertCount === 1 ? '' : 's'}` : 'View live radar — no active alerts'}
      >
        {statusLabel}
        <span className="text-xs opacity-75" aria-hidden="true">↓</span>
      </button>

      {uniqueTypes.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1.5 mt-2 max-w-2xl">
          {uniqueTypes.map(({ event, icon }) => (
            <span
              key={event}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-600/80 bg-slate-900/50 text-xs text-slate-300"
            >
              <span aria-hidden="true">{icon}</span>
              <span className="truncate max-w-[12rem]">{event}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
