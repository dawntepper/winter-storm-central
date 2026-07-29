import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapViewerSkeleton } from '../Skeletons';

const StormMap = lazy(() => import('../StormMap'));

/**
 * Full-width hazard-filtered radar — visual centerpiece after Current Situation.
 * Uses StormMap presentation="embedded" for alert-extent fit; height overrides
 * keep the map larger than the default compact embedded sizing.
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
        className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 [&_.leaflet-container]:!h-[clamp(360px,50vh,440px)] md:[&_.leaflet-container]:!h-[500px] lg:[&_.leaflet-container]:!h-[560px]"
      >
        <Suspense
          fallback={
            <MapViewerSkeleton className="h-[clamp(360px,50vh,440px)] md:h-[500px] lg:h-[560px]" />
          }
        >
          <StormMap
            weatherData={{}}
            alerts={mapAlerts}
            isHero
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
