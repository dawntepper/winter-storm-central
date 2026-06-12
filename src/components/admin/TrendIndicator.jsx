const NOTABLE_THRESHOLD = 15;
const CONCERNING_THRESHOLD = 15;

function getTrendStyle(trend, sentiment = 'positive') {
  const { direction, changePct } = trend;
  const abs = Math.abs(changePct);

  if (direction === 'flat' || abs < 2) {
    return { colorClass: 'text-slate-400', label: 'Flat' };
  }

  const favorable =
    (direction === 'up' && sentiment === 'positive') ||
    (direction === 'down' && sentiment === 'negative');

  const unfavorable =
    (direction === 'down' && sentiment === 'positive') ||
    (direction === 'up' && sentiment === 'negative');

  if (favorable) {
    return {
      colorClass: abs >= NOTABLE_THRESHOLD ? 'text-emerald-300' : 'text-emerald-400',
      label: direction === 'up' ? 'Up' : 'Down',
    };
  }

  if (unfavorable && abs >= CONCERNING_THRESHOLD) {
    return { colorClass: 'text-rose-400', label: direction === 'up' ? 'Up' : 'Down' };
  }

  if (unfavorable || (abs >= NOTABLE_THRESHOLD && abs < 25)) {
    return { colorClass: 'text-amber-400', label: direction === 'up' ? 'Up' : 'Down' };
  }

  return {
    colorClass: favorable ? 'text-emerald-400' : 'text-slate-400',
    label: direction === 'up' ? 'Up' : 'Down',
  };
}

export default function TrendIndicator({
  trend,
  compact = false,
  label = 'vs prior period',
  sentiment = 'positive',
}) {
  if (!trend) return null;

  const { direction, changePct, current, previous } = trend;
  const { colorClass, label: dirLabel } = getTrendStyle(trend, sentiment);
  const sizeClass = compact ? 'text-xs' : 'text-sm';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

  if (direction === 'flat') {
    return (
      <span className={`text-slate-400 ${sizeClass}`}>
        → Flat ({changePct >= 0 ? '+' : ''}{changePct}% {label})
      </span>
    );
  }

  return (
    <span className={`font-medium ${sizeClass} ${colorClass}`}>
      {arrow} {dirLabel} {Math.abs(changePct)}% {label}
      {!compact && previous != null && (
        <span className="text-slate-500 font-normal ml-1">
          ({current?.toLocaleString?.() ?? current} vs {previous?.toLocaleString?.() ?? previous})
        </span>
      )}
    </span>
  );
}
