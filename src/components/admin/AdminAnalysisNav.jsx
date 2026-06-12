import { useEffect, useState, useCallback } from 'react';

export const ANALYSIS_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'returning-visitors', label: 'Returning Visitors' },
  { id: 'location-searches', label: 'Location Searches' },
  { id: 'county-alert-views', label: 'County Alert Views' },
  { id: 'saved-locations', label: 'Saved Locations' },
  { id: 'radar-engagement', label: 'Radar Engagement' },
  { id: 'user-journeys', label: 'User Journeys' },
];

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const nav = document.getElementById('admin-analysis-nav');
  const navHeight = nav?.offsetHeight ?? 0;
  const header = document.getElementById('admin-analysis-header');
  const headerHeight = header?.offsetHeight ?? 0;
  const offset = navHeight + headerHeight + 8;
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
    const header = document.getElementById('admin-analysis-header');
    const offset = (nav?.offsetHeight ?? 0) + (header?.offsetHeight ?? 0) + 16;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${offset}px 0px -55% 0px`,
        threshold: [0, 0.1, 0.25, 0.5],
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
        <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-thin">
          {ANALYSIS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => handleClick(section.id)}
              className={`shrink-0 px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                activeId === section.id
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-sky-500/50 hover:text-white'
              }`}
            >
              {section.label}
            </button>
          ))}
          <div className="shrink-0 flex items-center gap-1.5 ml-auto pl-2 border-l border-slate-700">
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
