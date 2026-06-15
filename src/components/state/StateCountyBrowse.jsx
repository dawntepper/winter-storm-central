import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCountiesForState } from '../../services/locationCatalogService';
import { trackCountyResultClick } from '../../utils/analytics';

const INITIAL_SHOW = 24;

/**
 * Browseable county grid for a state — anchor target for quick actions.
 */
export default function StateCountyBrowse({ stateCode, stateName }) {
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const rows = await getCountiesForState(stateCode);
      if (!cancelled) {
        setCounties(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  if (loading) {
    return (
      <section id="state-counties" className="scroll-mt-4">
        <h2 className="text-lg font-semibold text-white mb-2">{stateName} Counties</h2>
        <p className="text-sm text-slate-500">Loading counties…</p>
      </section>
    );
  }

  if (counties.length === 0) return null;

  const visible = showAll ? counties : counties.slice(0, INITIAL_SHOW);

  return (
    <section id="state-counties" className="scroll-mt-4">
      <h2 className="text-lg font-semibold text-white mb-2">{stateName} Counties</h2>
      <p className="text-sm text-slate-400 mb-4">
        County-level NWS alerts across {stateName}.
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((county) => (
          <Link
            key={county.id}
            to={`/alerts/county/${county.slug}`}
            onClick={() =>
              trackCountyResultClick({
                countySlug: county.slug,
                stateCode: county.stateCode,
                source: 'state-page-county-browse',
              })
            }
            className="text-sm px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/40 hover:border-violet-400/65 rounded-full text-violet-200 hover:text-white transition-colors truncate text-center"
            title={`${county.name} County`}
          >
            {county.name}
          </Link>
        ))}
      </div>
      {counties.length > INITIAL_SHOW && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 text-sm text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
        >
          Show all {counties.length} counties →
        </button>
      )}
    </section>
  );
}
