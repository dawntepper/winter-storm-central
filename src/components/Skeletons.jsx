/**
 * Reusable skeleton placeholders for loading states.
 * Matches slate/dark theme with animate-pulse.
 */

export function Skeleton({ className = '' }) {
  return <div className={`bg-slate-700 rounded animate-pulse ${className}`} />;
}

/** Alert card list placeholder. */
export function AlertListSkeleton({ count = 4, showHeader = true, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {showHeader && <Skeleton className="h-5 w-48" />}
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3 animate-pulse"
        >
          <div className="flex gap-3">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="flex-1 h-5" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Generic card placeholder. */
export function CardSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3 animate-pulse ${className}`}>
      <Skeleton className="h-5 w-2/3" />
      {[...Array(lines)].map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}
