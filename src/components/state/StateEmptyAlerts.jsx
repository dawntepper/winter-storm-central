/**
 * Compact alert status for the state page right rail.
 */
export default function StateEmptyAlerts({ alertCount = 0, lastUpdated, loading = false }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5 animate-pulse">
        <div className="h-4 w-36 bg-slate-700 rounded mb-1.5" />
        <div className="h-3 w-28 bg-slate-700/70 rounded" />
      </div>
    );
  }

  const hasAlerts = alertCount > 0;
  const checkedLabel = lastUpdated
    ? `Last checked ${new Date(lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : null;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        hasAlerts
          ? 'border-amber-500/30 bg-amber-500/10'
          : 'border-emerald-500/30 bg-emerald-500/10'
      }`}
      role="status"
      aria-live="polite"
    >
      <p
        className={`text-sm font-semibold ${
          hasAlerts ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        {hasAlerts ? (
          <>
            <span aria-hidden="true">⚠ </span>
            {alertCount} Active {alertCount === 1 ? 'Alert' : 'Alerts'}
          </>
        ) : (
          <>
            <span aria-hidden="true">✓ </span>
            No Active Alerts
          </>
        )}
      </p>
      {checkedLabel && (
        <p className="text-[11px] text-slate-500 mt-0.5">{checkedLabel}</p>
      )}
    </div>
  );
}
