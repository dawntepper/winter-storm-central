import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageSiteHeader from '../components/PageSiteHeader';
import SiteFooter from '../components/SiteFooter';
import CurrentSituation from '../components/severe-weather/CurrentSituation';
import HazardRadarSection from '../components/severe-weather/HazardRadarSection';
import CurrentHazardAlerts from '../components/severe-weather/CurrentHazardAlerts';
import RelatedSevereWeather from '../components/severe-weather/RelatedSevereWeather';
import HazardEducationalContent from '../components/severe-weather/HazardEducationalContent';
import { useHazardEngine } from '../hooks/useHazardEngine';
import { hazardEngine } from '../../shared/hazard-engine/index.js';
import {
  trackSevereWeatherPageView,
  trackSevereWeatherAlertOpened,
  trackSevereWeatherStateClick,
  trackSevereWeatherRelatedClick,
  trackSevereWeatherStateListExpanded,
  trackSevereWeatherWarningsAnchorClick,
  NAV_SOURCES,
} from '../utils/analytics';

function activeCountBucket(count) {
  if (!count) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 15) return '6-15';
  return '16+';
}

function pageIntro(hazard) {
  const label = (hazard.pluralLabel || 'alerts').toLowerCase();
  return `Track active ${label} across the United States.`;
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
        { '@type': 'ListItem', position: 2, name: 'Alerts', item: 'https://stormtracking.io/alerts' },
        { '@type': 'ListItem', position: 3, name: hazard.pageTitle, item: url },
      ],
    },
  ]);
  document.head.appendChild(script);
}

function NotFoundHazard({ slug }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageSiteHeader
        source={NAV_SOURCES.HEADER_NAVIGATION}
        maxWidthClass="max-w-5xl"
      />
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
 * SevereWeatherHazardPage — Hazard Engine snapshot as source of truth.
 *
 * Hierarchy: intro → Current Situation → Radar → Current alerts
 * → Related → Educational / FAQ / Sources
 */
export default function SevereWeatherHazardPage() {
  const { hazardSlug } = useParams();
  const config = hazardEngine.getConfig(hazardSlug);
  const { snapshot, lastUpdated, allAlerts, loading: alertsLoading } = useHazardEngine(hazardSlug);

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
  }, [hazardSlug]); // eslint-disable-line react-hooks/exhaustive-deps -- once per slug

  if (!config) {
    return <NotFoundHazard slug={hazardSlug} />;
  }

  const hazard = snapshot?.ok
    ? snapshot
    : hazardEngine.get(hazardSlug, [], { dataAvailable: true });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PageSiteHeader source={NAV_SOURCES.HEADER_NAVIGATION} />

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
          {pageIntro(hazard)}
        </p>

        <div className="mt-4">
          {alertsLoading ? (
            <section
              aria-labelledby="current-situation-heading"
              className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3.5"
              style={{ borderLeftWidth: 4, borderLeftColor: hazard.severityColor || '#64748b' }}
            >
              <h2 id="current-situation-heading" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Current Situation
              </h2>
              <p className="text-sm text-slate-400" role="status">
                Checking National Weather Service alerts…
              </p>
            </section>
          ) : (
            <CurrentSituation
              hazard={hazard}
              onAlertsClick={() => trackSevereWeatherWarningsAnchorClick(analyticsProps)}
              onStateClick={(state) => trackSevereWeatherStateClick({
                ...analyticsProps,
                destination_state_code: state.code,
                source_section: 'current_situation',
              })}
              onExpandStates={() => trackSevereWeatherStateListExpanded(analyticsProps)}
            />
          )}
        </div>

        <HazardRadarSection
          hazard={{
            ...hazard,
            singularLabel: hazard.hazardLabel,
          }}
          alerts={allAlerts || hazard.alerts || []}
        />

        <CurrentHazardAlerts
          hazard={hazard}
          onAlertOpen={(alert) => trackSevereWeatherAlertOpened({
            ...analyticsProps,
            alert_event: alert?.event,
            source_section: 'current_alerts',
          })}
        />

        <RelatedSevereWeather
          relatedHazards={hazard.relatedHazards}
          onRelatedClick={(item) => trackSevereWeatherRelatedClick({
            ...analyticsProps,
            related_hazard_slug: item.slug,
            source_section: 'related_severe_weather',
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
