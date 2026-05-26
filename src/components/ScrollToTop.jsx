import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll behavior on route changes:
 *   - POP (back/forward button): preserve the browser's natural scroll
 *     restoration so users return to where they were.
 *   - Hash anchor (#section): scroll to the matching element so links like
 *     /prep#stay-informed work as expected. Falls back to scrolling to top
 *     if the anchor isn't found.
 *   - Otherwise: scroll to top (the default new-page behavior).
 *
 * The hash branch uses requestAnimationFrame so the target route's DOM has
 * finished committing before we try to find the element.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === 'POP') return;

    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash, navType]);

  return null;
}
