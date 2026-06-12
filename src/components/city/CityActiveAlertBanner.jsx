import { ALERT_CATEGORIES } from '../../../shared/nws-alert-parser';

function severityDot(severity) {
  if (severity === 'Extreme') return '🔴';
  if (severity === 'Severe') return '🟠';
  if (severity === 'Moderate') return '🟡';
  return '🔵';
}

function formatExpires(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return null;
  }
}

function scrollToAlerts(e) {
  e.preventDefault();
  const el = document.getElementById('city-active-alerts');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const toggle = el.querySelector('[data-alert-section-toggle]');
    if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
      toggle.click();
    }
  }
}

/**
 * Compact alert banner (~80px max) below hero — scrolls/expands full NWS section.
 * Alerts expected pre-sorted by severity (highest first).
 */
export default function CityActiveAlertBanner({ alerts, loading = false }) {
  if (loading || !alerts || alerts.length === 0) return null;

  const count = alerts.length;
  const topAlert = alerts[0];
  const category = ALERT_CATEGORIES[topAlert.category];
  const expiresLabel = formatExpires(topAlert.expires || topAlert.ends);
  const dot = category?.icon || severityDot(topAlert.severity);

  return (
    <a
      href="#city-active-alerts"
      onClick={scrollToAlerts}
      className="flex items-center gap-2 max-h-20 px-4 py-3 rounded-xl border border-orange-500/40 bg-orange-500/10 text-sm text-orange-100 hover:bg-orange-500/15 transition-colors overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <span className="flex-shrink-0" aria-hidden="true">{dot}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">
          {count} Active Alert{count === 1 ? '' : 's'}
        </span>
        {' — '}
        <span>{topAlert.event}</span>
        {expiresLabel && (
          <span className="text-orange-200/80"> until {expiresLabel}</span>
        )}
        {count > 1 && (
          <span className="text-orange-200/70"> (+{count - 1} more)</span>
        )}
      </span>
      <span className="flex-shrink-0 text-xs font-semibold text-orange-200 whitespace-nowrap">
        View Details →
      </span>
    </a>
  );
}
