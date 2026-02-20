import { useEffect, useState } from 'react';

/**
 * Mobile-only sticky nav that appears when the main map scrolls out of view.
 * Shows a "Back to Map" button + quick-jump links to visualization sections.
 */
export default function StickyMiniMap({ selectedStateCode, mainMapId = 'storm-map-mobile' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(mainMapId);
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && window.innerWidth < 1024);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);

    const handleResize = () => {
      if (window.innerWidth >= 1024) setVisible(false);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [mainMapId]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-3 right-3 z-[1000] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-600/95 border border-slate-500 backdrop-blur-sm shadow-lg shadow-black/40">
      <span className="text-[11px] text-slate-300 font-medium flex-shrink-0">Jump to:</span>
      <a href="#top-states" className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
        Top States
      </a>
      <a href="#alert-heatmap" className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
        Heatmap
      </a>
      <a href="#extreme-weather" className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
        Alerts
      </a>
    </div>
  );
}
