import { useEffect, useState, useCallback } from 'react';

export const ANALYSIS_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'returning-visitors', label: 'Visitors' },
  { id: 'location-searches', label: 'Searches' },
  { id: 'county-alert-views', label: 'Counties' },
  { id: 'saved-locations', label: 'Saved' },
  { id: 'radar-engagement', label: 'Radar' },
  { id: 'storm-events', label: 'Storms' },
  { id: 'user-journeys', label: 'Journeys' },
];

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const nav = document.getElementById('admin-analysis-nav');
  const navHeight = nav?.offsetHeight ?? 0;
  const stickyDate = document.getElementById('sticky-date-range');
  const stickyDateHeight = stickyDate?.offsetHeight ?? 0;
  const offset = navHeight + stickyDateHeight + 12;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

export default function AdminAnalysisNav({
  onCollapseAll,
  onExpandAll,
}) {
  const [activeId, setActiveId] = useState('overview');

  useEffect(() => {
    const sectionEls = ANALYSIS_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (sectionEls.length === 0) return undefined;

    const nav = document.getElementById('admin-analysis-nav');
    const stickyDate = document.getElementById('sticky-date-range');
    const offset =
      (nav?.offsetHeight ?? 0) + (stickyDate?.offsetHeight ?? 0) + 20;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            if (b.intersectionRatio !== a.intersectionRatio) {
              return b.intersectionRatio - a.intersectionRatio;
            }
            return a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top;
          });
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${offset}px 0px -50% 0px`,
        threshold: [0, 0.05, 0.15, 0.35, 0.5],
      }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback((id) => {
    setActiveId(id);
    scrollToSection(id);
  }, []);

  return (
    <nav
      id="admin-analysis-nav"
      className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/80"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-thin">
          {ANALYSIS_SECTIONS.map((section) => {
            const isActive = activeId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleClick(section.id)}
                className={`shrink-0 px-3 py-2 text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-sky-400 text-sky-300 font-semibold bg-sky-950/30'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {section.label}
              </button>
            );
          })}
          <div className="shrink-0 flex items-center gap-1.5 ml-auto pl-3 border-l border-slate-700">
            <button
              type="button"
              onClick={onCollapseAll}
              className="px-2 py-1 text-[11px] sm:text-xs text-slate-400 hover:text-white border border-slate-700 rounded-md hover:border-slate-600 cursor-pointer whitespace-nowrap"
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={onExpandAll}
              className="px-2 py-1 text-[11px] sm:text-xs text-slate-400 hover:text-white border border-slate-700 rounded-md hover:border-slate-600 cursor-pointer whitespace-nowrap"
            >
              Expand All
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
