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
        return (
          <div key={step.step ?? index}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs mb-1.5">
              <span className="text-slate-200 font-medium">
                {step.step}. {formatEventName(step.eventName)}
              </span>
              <span className="text-slate-400 tabular-nums">
                {formatNumber(step.sessions)} sessions ·{' '}
                {formatPct(step.completionPct)} complete · Drop-off{' '}
                {formatPct(step.dropoffPct)}
              </span>
            </div>
            <div className="h-7 bg-slate-800 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: CHART_COLORS.sky,
                  opacity: 0.85 - index * 0.08,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
