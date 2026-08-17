import { useState } from 'react';
import { Link } from 'react-router-dom';
// Eager StormMap: hazard pages already wait on a lazy route chunk; a second
// lazy() here serialized page paint → chunk download → map mount. Static
// import lets Vite load StormMap with (or as a dependency of) the page chunk
// and warms the RainViewer manifest as soon as this module evaluates.
import StormMap from '../StormMap';

/** StormMap category ids that use the wider tropical basin embed frame. */
const TROPICAL_MAP_FAMILY = 'tropical';

/**
 * Full-width hazard-filtered radar — visual centerpiece after Current Situation.
 * Uses StormMap presentation="embedded" for alert-extent fit; height overrides
 * keep the map larger than the default compact embedded sizing.
 *
 * Pass hazard-filtered alerts (not the full national feed) so framing matches
 * markers. Tropical-family hazards use US+Caribbean basin framing.
 */
export default function HazardRadarSection({ hazard, alerts = [] }) {
  const [activeCategories] = useState(() => new Set([hazard.radarCategory]));
  const radarLabel = hazard.singularLabel || hazard.hazardLabel;
  const embedMapFamily = hazard.radarCategory === TROPICAL_MAP_FAMILY
    ? TROPICAL_MAP_FAMILY
    : null;

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
        <StormMap
          weatherData={{}}
          alerts={alerts}
          isHero
          presentation="embedded"
          embedFit="alerts"
          embedContextKey={hazard.slug}
          embedMapFamily={embedMapFamily}
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
      </div>
    </section>
  );
}
