import { useEffect, useRef } from 'react';
import { trackCityRadarViewed } from '../../utils/analytics';

/**
 * Live radar block with City Radar Viewed analytics (mount + intersection observer).
 */
export default function CityRadarSection({
  cityName,
  citySlug,
  stateCode,
  analyticsSource,
  hasAlerts = false,
  children,
}) {
  const sectionRef = useRef(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    const fireViewed = () => {
      if (viewedRef.current) return;
      viewedRef.current = true;
      trackCityRadarViewed({
        stateCode,
        city: cityName,
        citySlug,
        source: analyticsSource,
        hasAlerts,
      });
    };

    fireViewed();

    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          fireViewed();
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px' },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [cityName, citySlug, stateCode, analyticsSource, hasAlerts]);

  return (
    <div ref={sectionRef} className="min-h-0">
      {children}
    </div>
  );
}
