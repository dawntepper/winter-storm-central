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

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const widthPct = Math.max(4, (step.sessions / maxSessions) * 100);
        const highDropOff = (step.dropoffPct ?? 0) >= 25;
        return (
          <div key={step.step ?? index}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs mb-1">
              <span className={`font-medium ${highDropOff ? 'text-rose-200' : 'text-slate-200'}`}>
                {step.step}. {formatEventName(step.eventName)}
              </span>
              <span className={`tabular-nums ${highDropOff ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                {formatNumber(step.sessions)} sessions ·{' '}
                {formatPct(step.completionPct)} complete · Drop-off{' '}
                {formatPct(step.dropoffPct)}
              </span>
            </div>
            <div className="h-6 bg-slate-800 rounded-md overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: highDropOff ? '#f43f5e' : CHART_COLORS.sky,
                  opacity: highDropOff ? 0.9 : 0.85 - index * 0.08,
                }}
              />
              {highDropOff && index > 0 && (
                <div
                  className="absolute right-0 top-0 h-full border-l-2 border-dashed border-rose-400/60"
                  style={{ width: `${Math.min(100 - widthPct, 40)}%`, marginLeft: `${widthPct}%` }}
                  title="Sessions lost at this step"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
