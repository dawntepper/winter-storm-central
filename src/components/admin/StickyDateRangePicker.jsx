import { useEffect, useState } from 'react';

export const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'all', label: 'All Time' },
];

function DateRangeButtons({ value, onChange, disabled, compact = false }) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'gap-1.5' : ''}`}>
      {DATE_RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(range.id)}
          className={`rounded-lg border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          } ${
            value === range.id
              ? 'bg-sky-600 border-sky-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-sky-500/50'
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

export default function StickyDateRangePicker({ value, onChange, disabled }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById('date-range-sentinel');
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-1px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div id="date-range-sentinel" className="h-0 w-full" aria-hidden />
      {stuck && (
        <div
          id="sticky-date-range"
          className="fixed left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/80 shadow-lg"
          style={{ top: 'var(--sticky-date-top, 0px)' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">Date range</span>
            <DateRangeButtons value={value} onChange={onChange} disabled={disabled} compact />
          </div>
        </div>
      )}
    </>
  );
}

export { DateRangeButtons };
