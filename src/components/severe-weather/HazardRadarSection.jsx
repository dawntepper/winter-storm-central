import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const StormMap = lazy(() => import('../StormMap'));

/**
 * Hazard-filtered radar using existing StormMap + eventFilter.
 * Heading is optional when the parent page supplies layout chrome.
 */
export default function HazardRadarSection({
  hazard,
  alerts = [],
  showHeading = true,
  className = '',
}) {
  const [activeCategories] = useState(() => new Set([hazard.radarCategory]));

  const mapAlerts = useMemo(() => alerts, [alerts]);

  return (
    <section
      aria-labelledby={showHeading ? 'hazard-radar-heading' : undefined}
      aria-label={showHeading ? undefined : `Live ${hazard.singularLabel || hazard.hazardLabel} radar`}
      className={className}
    >
      {showHeading && (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 id="hazard-radar-heading" className="text-lg font-semibold text-white">
            Live {hazard.singularLabel || hazard.hazardLabel} Radar
          </h2>
          <Link
            to="/radar"
            className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Open Full Radar →
          </Link>
        </div>
      )}

      <div
        id="hazard-radar-map"
        className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 [&_.leaflet-container]:!h-[42vh] lg:[&_.leaflet-container]:!h-[480px]"
        style={{ minHeight: '280px' }}
      >
        <Suspense
          fallback={
            <div className="h-[42vh] lg:h-[480px] min-h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Loading radar…
            </div>
          }
        >
          <StormMap
            weatherData={{}}
            alerts={mapAlerts}
            isHero
            heroCompact
            fitConusView
            activeCategories={activeCategories}
            eventFilter={hazard.nwsEvents}
            lockCategoryFilters
            analyticsPageContext="severe_weather"
            showResetView
            resetUsesUsDefault
          />
        </Suspense>
      </div>

      {!showHeading && (
        <div className="mt-2 flex justify-end">
          <Link
            to="/radar"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Open Full Radar →
          </Link>
        </div>
      )}
    </section>
  );
}
