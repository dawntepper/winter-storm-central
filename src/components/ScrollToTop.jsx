import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Scroll to top on forward navigation only — back/forward (POP) preserves the
// browser's natural scroll restoration so users return to where they were.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, navType]);

  return null;
}
