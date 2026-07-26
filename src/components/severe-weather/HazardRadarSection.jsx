import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const StormMap = lazy(() => import('../StormMap'));

/**
 * Full-width hazard-filtered radar — visual centerpiece after Current Situation.
 * Mobile uses StormMap presentation="embedded" (compact height + alert-extent fit).
 */
export default function HazardRadarSection({ hazard, alerts = [] }) {
  const [activeCategories] = useState(() => new Set([hazard.radarCategory]));
  const mapAlerts = useMemo(() => alerts, [alerts]);
  const radarLabel = hazard.singularLabel || hazard.hazardLabel;

  return (
    <section aria-labelledby="hazard-radar-heading" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 id="hazard-radar-heading" className="text-lg font-semibold text-white">
          Live {radarLabel} Radar
        </h2>
        <Link
          to="/radar"
          className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
        >
          Open Full Radar →
        </Link>
      </div>

      <div
        id="hazard-radar-map"
        className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 lg:[&_.leaflet-container]:!h-[520px]"
      >
        <Suspense
          fallback={
            <div className="h-[clamp(280px,42vh,320px)] lg:h-[520px] flex items-center justify-center text-slate-400 text-sm">
              Loading radar…
            </div>
          }
        >
          <StormMap
            weatherData={{}}
            alerts={mapAlerts}
            isHero
            heroCompact
            presentation="embedded"
            embedFit="alerts"
            embedContextKey={hazard.slug}
            fitConusView
            activeCategories={activeCategories}
            eventFilter={hazard.nwsEvents}
            lockCategoryFilters
            analyticsPageContext="severe_weather"
            showResetView
            resetUsesUsDefault
            resetViewLabel="Reset View"
            resetViewTitle="Reset hazard map view"
          />
        </Suspense>
      </div>
    </section>
  );
}
