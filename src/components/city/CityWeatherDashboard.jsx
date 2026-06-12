import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageBackNav from '../PageBackNav';
import CityAlertStatusCard from './CityAlertStatusCard';
import CitySaveLocationToggle from './CitySaveLocationToggle';
import CityActiveAlertBanner from './CityActiveAlertBanner';
import CityAlertsSectionDefault from './CityAlertsSection';
import { sortAlertsBySeverity } from '../../utils/alertRanking';

const cardClasses = 'group flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 transition-all duration-200 hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/10';
const ctaClass = 'text-sm font-semibold text-sky-400 group-hover:text-sky-300 flex-shrink-0 transition-colors';

export function CityRelatedLinks({ cityName, lat, lon, stateSlug, stateLabel }) {
  const radarUrl = `/radar?lat=${lat}&lon=${lon}`;
  return (
    <section aria-label="Related links">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Related
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to={radarUrl} className={cardClasses}>
          <div>
            <p className="text-sm font-medium text-white">Live radar for {cityName}</p>
            <p className="text-xs text-slate-400 mt-0.5">Real-time precipitation and storm tracking</p>
          </div>
          <span className={ctaClass} aria-hidden="true">Open →</span>
        </Link>
        {stateSlug && (
          <Link to={`/alerts/${stateSlug}`} className={cardClasses}>
            <div>
              <p className="text-sm font-medium text-white">All {stateLabel} weather alerts</p>
              <p className="text-xs text-slate-400 mt-0.5">Statewide active warnings and watches</p>
            </div>
            <span className={ctaClass} aria-hidden="true">View Alerts →</span>
          </Link>
        )}
      </div>
    </section>
  );
}

export function CityNearbyLinks({ title, cities }) {
  if (!cities || cities.length === 0) return null;
  return (
    <section aria-label="Nearby cities">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {cities.filter((c) => c.href).map((entry) => (
          <Link
            key={entry.slug || entry.id}
            to={entry.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 rounded-full text-sky-300 hover:text-sky-200 transition-colors"
          >
            {entry.label}
            <span aria-hidden="true" className="text-xs font-semibold text-sky-400">View Alerts →</span>
          </Link>
        ))}
      </div>
      {cities.some((c) => c.comingSoon) && (
        <p className="text-xs text-slate-500 mt-2">
          More coming soon: {cities.filter((c) => c.comingSoon).map((c) => c.label).join(' • ')}
        </p>
      )}
    </section>
  );
}

const SEASON_LABEL = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

const HAZARD_LABELS = {
  hurricane: 'Hurricanes',
  'tropical-storm': 'Tropical storms',
  flooding: 'Flooding',
  'severe-thunderstorm': 'Severe thunderstorms',
  lightning: 'Lightning',
  'cold-front': 'Cold fronts',
  'cold-fronts': 'Cold fronts',
  tornado: 'Tornadoes',
  'winter-storm': 'Winter storms',
  'ice-storm': 'Ice storms',
  heat: 'Extreme heat',
  wildfire: 'Wildfires',
  'high-wind': 'High wind',
};

export function CitySeasonalRisk({ description, seasonalRisks, season }) {
  if (!seasonalRisks) return null;
  return (
    <section aria-label="Seasonal risk profile">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Seasonal Risk Profile
      </h2>
      {description && (
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{description}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SEASON_ORDER.map((s) => {
          const risks = seasonalRisks[s] || [];
          const isCurrent = s === season;
          return (
            <div
              key={s}
              className={`rounded-lg p-3 border ${
                isCurrent
                  ? 'border-sky-400/50 bg-sky-500/10'
                  : 'border-slate-700 bg-slate-800/50'
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isCurrent ? 'text-sky-300' : 'text-slate-400'}`}>
                {SEASON_LABEL[s]}{isCurrent && ' • Now'}
              </p>
              <ul className="space-y-1">
                {risks.length === 0 && (
                  <li className="text-xs text-slate-500">Low risk</li>
                )}
                {risks.map((r) => (
                  <li key={r} className="text-xs text-slate-300">
                    {HAZARD_LABELS[r] || r}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * ForecastPage-inspired layout shell for city alert dashboards.
 * Section order: hero → alert summary → radar → forecast → full NWS text → related.
 */
export default function CityWeatherDashboard({
  jsonLdBlocks = [],
  headerNav,
  stateBackLink,
  breadcrumb,
  title,
  subtitle,
  cityName,
  lat,
  lon,
  citySlug,
  stateCode,
  alerts,
  alertsLoading = false,
  alertsError = false,
  lastUpdated,
  currentConditions,
  rightNow,
  radar,
  forecast,
  alertsSection,
  related,
  nearby,
  seasonal,
  footer,
  signupBar,
  alertsSignupHint = false,
}) {
  const sortedAlerts = useMemo(
    () => (Array.isArray(alerts) ? sortAlertsBySeverity(alerts) : alerts),
    [alerts],
  );
  const alertCount = Array.isArray(sortedAlerts) ? sortedAlerts.length : 0;
  const hasAlerts = alertCount > 0;

  return (
    <div className="min-h-screen bg-slate-900">
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <PageBackNav />
            <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
              <span className="text-xl" aria-hidden="true">📡</span>
              <span className="text-lg sm:text-xl font-bold">StormTracking</span>
            </Link>
          </div>
          {headerNav}
        </div>
      </header>

      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto">
          {stateBackLink}
          {breadcrumb}
          <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="lg:grid lg:grid-cols-[2fr_1fr] gap-4 space-y-4 lg:space-y-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <CityAlertStatusCard
                cityName={cityName}
                alerts={sortedAlerts}
                loading={alertsLoading}
                error={alertsError}
                lastUpdated={lastUpdated}
                compact={!hasAlerts}
                lat={lat}
                lon={lon}
              />
              <CitySaveLocationToggle
                locationName={`${cityName}${stateCode ? `, ${stateCode}` : ''}`}
                lat={lat}
                lon={lon}
                citySlug={citySlug}
                stateCode={stateCode}
                variant="inline"
              />
            </div>
            {currentConditions}
          </div>
          {rightNow}
        </div>

        <CityActiveAlertBanner
          alerts={sortedAlerts}
          loading={alertsLoading || alerts === null}
        />

        {radar}
        {forecast}
        <div id="city-active-alerts">
          {alertsSection ?? (hasAlerts ? (
            <CityAlertsSectionDefault
              cityName={cityName}
              alerts={sortedAlerts}
              loading={alertsLoading}
              error={alertsError}
              lat={lat}
              lon={lon}
              signupHint={alertsSignupHint}
            />
          ) : null)}
        </div>
        {related}
        {nearby}
        {seasonal}
        {footer}
      </main>

      {signupBar}
    </div>
  );
}

// Re-export for convenience when pages need custom alerts section
export { default as CityAlertsSection } from './CityAlertsSection';
