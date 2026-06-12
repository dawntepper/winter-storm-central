const SECTIONS_STORAGE_KEY = 'admin-analysis-sections';

export function readSectionExpandedState() {
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeSectionExpandedState(state) {
  try {
    localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export default function CollapsibleAnalysisSection({
  id,
  title,
  description,
  expanded,
  onToggle,
  headerExtra,
  className = 'bg-slate-800 border border-slate-700',
  children,
}) {
  return (
    <section id={id} className={`rounded-xl p-5 sm:p-6 scroll-mt-36 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-slate-400 hover:text-sky-300 border border-slate-600 hover:border-sky-500/50 px-2 py-0.5 rounded transition-colors cursor-pointer"
              aria-expanded={expanded}
              aria-controls={`${id}-content`}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {description && (
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          )}
        </div>
        {headerExtra}
      </div>

      {expanded && (
        <div id={`${id}-content`} className="mt-5">
          {children}
        </div>
      )}
    </section>
  );
}
