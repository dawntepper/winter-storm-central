import AdminEmptyChart from './AdminEmptyChart';
import { CHART_COLORS } from './chartTheme';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatPct(n) {
  if (n == null) return '—';
  return `${n}%`;
}

export default function AdminFunnel({
  stepStats,
  formatEventName = (name) => name,
  emptyMessage = 'No funnel data in this period.',
  compact = false,
}) {
  const steps = Array.isArray(stepStats)
    ? stepStats
    : stepStats
      ? Object.values(stepStats)
      : [];

  if (steps.length === 0) {
    return <AdminEmptyChart message={emptyMessage} />;
  }

  const maxSessions = steps[0]?.sessions || 1;
  const barHeight = compact ? 'h-4' : 'h-6';
  const spacing = compact ? 'space-y-2' : 'space-y-3';

  return (
    <div className={spacing}>
      {steps.map((step, index) => {
        const widthPct = Math.max(4, (step.sessions / maxSessions) * 100);
        const highDropOff = (step.dropoffPct ?? 0) >= 25;
        return (
          <div key={step.step ?? index}>
            <div className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 ${compact ? 'text-[11px]' : 'text-xs'} mb-0.5`}>
              <span className={`font-medium ${highDropOff ? 'text-rose-200' : 'text-slate-200'}`}>
                {step.step}. {formatEventName(step.eventName)}
              </span>
              <span className={`tabular-nums ${highDropOff ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                {formatNumber(step.sessions)}
                {!compact && (
                  <>
                    {' '}sessions · {formatPct(step.completionPct)} complete · Drop-off{' '}
                    {formatPct(step.dropoffPct)}
                  </>
                )}
                {compact && highDropOff && (
                  <span className="ml-1 text-rose-400">−{formatPct(step.dropoffPct)}</span>
                )}
              </span>
            </div>
            <div className={`${barHeight} bg-slate-800 rounded-md overflow-hidden relative`}>
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: highDropOff ? '#f43f5e' : CHART_COLORS.sky,
                  opacity: highDropOff ? 0.9 : 0.85 - index * 0.08,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
