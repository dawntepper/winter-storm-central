import { useEffect, useRef } from 'react';

/**
 * Hook to read ?location= URL parameter on page load and trigger
 * the location search automatically.
 *
 * Supports:
 *   - Zip codes: ?location=33916
 *   - City,State: ?location=Fort%20Myers,FL
 *
 * The hook calls the provided callback with the parsed location value
 * exactly once on mount (or when the URL changes).
 */
export function useLocationParam(onLocationDetected) {
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const location = params.get('location');

      if (!location || !location.trim()) return;

      hasProcessed.current = true;
      const value = decodeURIComponent(location).trim();

      // Determine type
      if (/^\d{5}$/.test(value)) {
        onLocationDetected({ type: 'zip', value });
      } else {
        // Treat as city,state or general search term
        onLocationDetected({ type: 'search', value });
      }

      // Clean up URL without reloading (remove the ?location= param)
      const url = new URL(window.location.href);
      url.searchParams.delete('location');
      window.history.replaceState({}, '', url.pathname + url.search);
    } catch (e) {
      // Silently fail — don't break the page for bad params
      console.warn('[useLocationParam] Failed to parse location param:', e);
    }
  }, [onLocationDetected]);
}
