const STATUS_CONFIG = {
  healthy: {
    emoji: '🟢',
    label: 'Healthy',
    border: 'border-emerald-700/50',
    bg: 'bg-emerald-950/20',
    titleColor: 'text-emerald-300',
  },
  warning: {
    emoji: '🟡',
    label: 'Warning',
    border: 'border-amber-700/50',
    bg: 'bg-amber-950/20',
    titleColor: 'text-amber-300',
  },
  issue: {
    emoji: '🔴',
    label: 'Issue',
    border: 'border-rose-700/50',
    bg: 'bg-rose-950/20',
    titleColor: 'text-rose-300',
  },
};

const CHECK_STATUS_DOT = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  issue: 'bg-rose-500',
};

function formatCheckedAt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function HealthStatusCard({ health }) {
  if (!health) return null;

  const config = STATUS_CONFIG[health.overall] || STATUS_CONFIG.warning;

  return (
    <div className={`rounded-xl border p-5 sm:p-6 ${config.border} ${config.bg}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <span aria-hidden>{config.emoji}</span>
            Analytics Health
            <span className={`text-sm font-semibold ${config.titleColor}`}>
              {config.label}
            </span>
          </h2>
          <p className="text-sm text-slate-400">
            Pipeline checks for the last 24 hours — visitor tracking, events, and AI brief readiness.
          </p>
        </div>
        {health.checkedAt && (
          <span className="text-xs text-slate-500">
            Checked {formatCheckedAt(health.checkedAt)}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(health.checks || []).map((check) => (
          <li
            key={check.id}
            className="flex items-start gap-2.5 bg-slate-900/50 border border-slate-700/60 rounded-lg px-3 py-2.5"
          >
            <span
              className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                CHECK_STATUS_DOT[check.status] || CHECK_STATUS_DOT.warning
              }`}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{check.label}</div>
              <div className="text-xs text-slate-400 mt-0.5 leading-snug">{check.message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
