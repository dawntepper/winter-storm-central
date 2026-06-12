import { useEffect, useState, useCallback } from 'react';

/** Show button after scrolling past half the viewport height. */
const SCROLL_THRESHOLD_RATIO = 0.5;

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * SCROLL_THRESHOLD_RATIO);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-40 px-3 py-2 text-sm font-medium rounded-lg border bg-slate-800/95 backdrop-blur-sm border-slate-600 text-slate-200 shadow-lg shadow-black/30 hover:border-sky-500/60 hover:text-white transition-colors cursor-pointer"
    >
      ↑ Top
    </button>
  );
}
