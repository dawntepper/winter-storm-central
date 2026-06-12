export default function TrendIndicator({ trend, compact = false, label = 'vs prior period' }) {
  if (!trend) return null;

  const { direction, changePct, current, previous } = trend;

  if (direction === 'flat') {
    return (
      <span className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        → Flat ({changePct >= 0 ? '+' : ''}{changePct}% {label})
      </span>
    );
  }

  const isUp = direction === 'up';
  return (
    <span
      className={`font-medium ${compact ? 'text-xs' : 'text-sm'} ${
        isUp ? 'text-emerald-400' : 'text-rose-400'
      }`}
    >
      {isUp ? '↑' : '↓'} {isUp ? 'Up' : 'Down'} {Math.abs(changePct)}% {label}
      {!compact && previous != null && (
        <span className="text-slate-500 font-normal ml-1">
          ({current?.toLocaleString?.() ?? current} vs {previous?.toLocaleString?.() ?? previous})
        </span>
      )}
    </span>
  );
}
