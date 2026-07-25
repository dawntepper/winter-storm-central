import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageBackNav from '../components/PageBackNav';
import PageHeaderNav from '../components/PageHeaderNav';
import SiteFooter from '../components/SiteFooter';
import LiveHazardStatus from '../components/severe-weather/LiveHazardStatus';
import WeatherBriefSection from '../components/severe-weather/WeatherBriefSection';
import HazardRadarSection from '../components/severe-weather/HazardRadarSection';
import CurrentHazardAlerts from '../components/severe-weather/CurrentHazardAlerts';
import AffectedStatesSection from '../components/severe-weather/AffectedStatesSection';
import RelatedSevereWeather from '../components/severe-weather/RelatedSevereWeather';
import HazardEducationalContent from '../components/severe-weather/HazardEducationalContent';
import { useHazardEngine } from '../hooks/useHazardEngine';
import { hazardEngine } from '../../shared/hazard-engine/index.js';
import {
  trackSevereWeatherPageView,
  trackSevereWeatherRadarClick,
  trackSevereWeatherAlertOpened,
  trackSevereWeatherStateClick,
  trackSevereWeatherRelatedClick,
  trackSevereWeatherStateListExpanded,
  NAV_SOURCES,
} from '../utils/analytics';

function activeCountBucket(count) {
  if (!count) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 15) return '6-15';
  return '16+';
}

function setPageMeta(hazard) {
  if (!hazard) return;
  const url = `https://stormtracking.io${hazard.href}`;
  document.title = hazard.seoTitle;

  const ensureMeta = (selector, attr, key, content) => {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  ensureMeta('meta[name="description"]', 'name', 'description', hazard.seoDescription);
  ensureMeta('meta[property="og:title"]', 'property', 'og:title', hazard.seoTitle);
  ensureMeta('meta[property="og:description"]', 'property', 'og:description', hazard.seoDescription);
  ensureMeta('meta[property="og:url"]', 'property', 'og:url', url);
  ensureMeta('meta[name="twitter:title"]', 'name', 'twitter:title', hazard.seoTitle);
  ensureMeta('meta[name="twitter:description"]', 'name', 'twitter:description', hazard.seoDescription);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);

  // Structured data: WebPage + BreadcrumbList (+ FAQ when present in DOM content)
  const existing = document.getElementById('severe-weather-jsonld');
  if (existing) existing.remove();
  const script = document.createElement('script');
  script.id = 'severe-weather-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: hazard.pageTitle,
      description: hazard.seoDescription,
      url,
      isPartOf: {
        '@type': 'WebSite',
        name: 'StormTracking',
        url: 'https://stormtracking.io',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://stormtracking.io/' },
        { '@type': 'ListItem', position: 2, name: 'Severe Weather', item: 'https://stormtracking.io/severe-weather/tornado-warning' },
        { '@type': 'ListItem', position: 3, name: hazard.pageTitle, item: url },
      ],
    },
  ]);
  document.head.appendChild(script);
}

function NotFoundHazard({ slug }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <PageBackNav />
          <PageHeaderNav source={NAV_SOURCES.HEADER_NAVIGATION} />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-3">Hazard page not found</h1>
        <p className="text-slate-400 mb-6">
          No severe-weather page exists for <code className="text-slate-300">{slug}</code>.
        </p>
        <Link to="/alerts" className="text-sky-400 hover:underline">
          Browse live weather alerts →
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * SevereWeatherHazardPage — consumes one Hazard Engine snapshot.
 */
export default function SevereWeatherHazardPage() {
  const { hazardSlug } = useParams();
  const config = hazardEngine.getConfig(hazardSlug);
  const { snapshot, briefLoading, lastUpdated, allAlerts, loading: alertsLoading } = useHazardEngine(hazardSlug);

  const analyticsProps = useMemo(() => ({
    hazard_slug: hazardSlug,
    active_count_bucket: activeCountBucket(snapshot?.activeCount),
    has_active_alerts: Boolean(snapshot?.activeCount > 0),
  }), [hazardSlug, snapshot?.activeCount]);

  useEffect(() => {
    if (!config || !snapshot?.ok) return;
    setPageMeta(snapshot);
  }, [config, snapshot]);

  useEffect(() => {
    if (!snapshot?.ok) return;
    trackSevereWeatherPageView(analyticsProps);
  }, [hazardSlug]); // eslint-disable-line react-hooks/exhaustive-deps -- fire once per slug

  if (!config) {
    return <NotFoundHazard slug={hazardSlug} />;
  }

  const hazard = snapshot?.ok
    ? snapshot
    : hazardEngine.get(hazardSlug, [], { dataAvailable: true });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <PageBackNav />
          <PageHeaderNav source={NAV_SOURCES.HEADER_NAVIGATION} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-3">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link to="/" className="hover:text-slate-300">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/alerts" className="hover:text-slate-300">Alerts</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-400" aria-current="page">{hazard.pageTitle}</li>
          </ol>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {hazard.pageTitle}
        </h1>
        <p className="mt-2 text-sm sm:text-[15px] text-slate-400 max-w-3xl leading-relaxed">
          {hazard.intro}
        </p>

        {/* Desktop: map left, Live Status + Weather Brief right. Mobile: status/brief first, then map. */}
        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-5 xl:gap-6 items-start">
          <div className="order-2 lg:order-1 min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
              <h2 id="hazard-radar-heading" className="text-lg font-semibold text-white">
                Live {hazard.hazardLabel} Radar
              </h2>
            </div>
            <HazardRadarSection
              hazard={{
                ...hazard,
                singularLabel: hazard.hazardLabel,
              }}
              alerts={allAlerts || hazard.alerts || []}
              showHeading={false}
            />
          </div>

          <aside className="order-1 lg:order-2 space-y-4 mb-5 lg:mb-0 lg:sticky lg:top-4">
            {alertsLoading ? (
              <section
                aria-labelledby="live-status-heading"
                className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3.5"
                style={{ borderLeftWidth: 4, borderLeftColor: hazard.severityColor || '#64748b' }}
              >
                <h2 id="live-status-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Live Status
                </h2>
                <p className="text-sm text-slate-400" role="status">Checking National Weather Service alerts…</p>
              </section>
            ) : (
              <LiveHazardStatus
                hazard={hazard}
                compact
                onRadarClick={() => trackSevereWeatherRadarClick(analyticsProps)}
                onAlertsClick={() => {}}
                onStateClick={(state) => trackSevereWeatherStateClick({
                  ...analyticsProps,
                  destination_state_code: state.code,
                })}
                onExpandStates={() => trackSevereWeatherStateListExpanded(analyticsProps)}
              />
            )}

            <WeatherBriefSection
              weatherBrief={hazard.weatherBrief}
              briefLoading={briefLoading}
              compact
            />
          </aside>
        </div>

        <CurrentHazardAlerts
          hazard={hazard}
          onAlertOpen={() => trackSevereWeatherAlertOpened(analyticsProps)}
        />

        <AffectedStatesSection
          hazard={hazard}
          onStateClick={(state) => trackSevereWeatherStateClick({
            ...analyticsProps,
            destination_state_code: state.code,
          })}
        />

        <RelatedSevereWeather
          relatedHazards={hazard.relatedHazards}
          onRelatedClick={(item) => trackSevereWeatherRelatedClick({
            ...analyticsProps,
            related_hazard_slug: item.slug,
          })}
        />

        <HazardEducationalContent contentKey={hazard.educationalContentKey} />

        <p className="mt-8 text-xs text-slate-600">
          Official alerts are provided by the National Weather Service. StormTracking organizes and displays this information for easier monitoring.
          {lastUpdated ? (
            <>
              {' '}Data last refreshed locally{' '}
              <time dateTime={new Date(lastUpdated).toISOString()}>
                {new Date(lastUpdated).toLocaleString()}
              </time>.
            </>
          ) : null}
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
