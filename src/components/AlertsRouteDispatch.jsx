import { useParams, Link } from 'react-router-dom';
import { SLUG_TO_ABBR } from '../data/stateConfig';
import StateAlertsPage from './StateAlertsPage';
import CityAlertsPage from './CityAlertsPage';
import citiesIndex from '../content/cities/index.json';

const CITY_SLUGS = new Set((citiesIndex.cities || []).map((c) => c.slug));

export default function AlertsRouteDispatch() {
  const { slug } = useParams();

  if (slug && SLUG_TO_ABBR[slug]) {
    return <StateAlertsPage />;
  }
  if (slug && CITY_SLUGS.has(slug)) {
    return <CityAlertsPage />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-slate-400 mb-6">
          We don&apos;t have an alerts page for &quot;{slug}&quot; yet.
        </p>
        <Link
          to="/alerts"
          className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
        >
          See all active alerts &rarr;
        </Link>
      </div>
    </div>
  );
}
