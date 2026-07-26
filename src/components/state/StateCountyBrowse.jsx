import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCountiesForState } from '../../services/locationCatalogService';
import { trackCountyResultClick, trackStateCountySelected } from '../../utils/analytics';

const INITIAL_SHOW = 24;

function normalizeCountyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+county$/i, '')
    .replace(/\s+parish$/i, '')
    .replace(/\s+borough$/i, '')
    .replace(/\s+census area$/i, '')
    .trim();
}

/**
 * Browseable county grid for a state — active counties (from normalized
 * areaDesc mapping) listed first when available, then full directory.
 */
export default function StateCountyBrowse({
  stateCode,
  stateName,
  affectedCounties = [],
}) {
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

  const activeJoined = useMemo(() => {
    if (!affectedCounties?.length || !counties.length) return [];

    const byKey = new Map(
      counties.map((c) => [normalizeCountyKey(c.name), c])
    );

    return affectedCounties
      .map((ac) => {
        const catalog = byKey.get(normalizeCountyKey(ac.name));
        if (!catalog) return null;
        return {
          ...catalog,
          activeCount: ac.activeCount ?? ac.alertCount ?? 0,
          hazards: ac.hazards || [],
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
        return a.name.localeCompare(b.name);
      });
  }, [affectedCounties, counties]);

  const activeIds = useMemo(
    () => new Set(activeJoined.map((c) => c.id)),
    [activeJoined]
  );

  if (loading) {
    return (
      <section id="state-counties" className="relative z-20">
        <h2 className="text-lg font-semibold text-white mb-2">
          {stateName} Alerts by County
        </h2>
        <p className="text-sm text-slate-500">Loading counties…</p>
      </section>
    );
  }

  if (counties.length === 0) return null;

  const directory = showAll ? counties : counties.slice(0, INITIAL_SHOW);

  const trackCounty = (county, source) => {
    trackCountyResultClick({
      countySlug: county.slug,
      stateCode: county.stateCode,
      source,
    });
    trackStateCountySelected({
      state: stateCode,
      county: county.name,
      sourceSection: source,
    });
  };

  return (
    <section id="state-counties" className="relative z-20 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-2">
          {stateName} Alerts by County
        </h2>
        <p className="text-sm text-slate-400">
          County-level NWS alerts and navigation across {stateName}.
        </p>
      </div>

      {activeJoined.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {stateName} Counties with Active Alerts
          </h3>
          <ul className="space-y-2">
            {activeJoined.map((county) => (
              <li key={county.id}>
                <Link
                  to={`/alerts/county/${county.slug}`}
                  onClick={() => trackCounty(county, 'state-page-active-counties')}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/50 transition-colors"
                  aria-label={`${county.name} County weather alerts, ${county.activeCount} active`}
                >
                  <span className="text-sm font-medium text-white">
                    {county.name} County
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-400">
                    {county.hazards?.length > 0 && (
                      <span className="inline-flex items-center gap-2">
                        {county.hazards.map((h) => (
                          <span key={h.id} title={`${h.label}: ${h.activeCount}`}>
                            <span aria-hidden="true">{h.icon}</span>{' '}
                            {h.activeCount}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="text-slate-300 font-medium">
                      {county.activeCount}{' '}
                      {county.activeCount === 1 ? 'alert' : 'alerts'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {affectedCounties.length > activeJoined.length && (
            <p className="mt-2 text-xs text-slate-500">
              Some alert areas could not be matched to the county directory and are omitted above.
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          All {stateName} Counties
        </h3>
        <div className="flex flex-wrap gap-2">
          {directory.map((county) => {
            const isActive = activeIds.has(county.id);
            return (
              <Link
                key={county.id}
                to={`/alerts/county/${county.slug}`}
                onClick={() => trackCounty(county, 'state-page-county-browse')}
                className={[
                  'text-sm px-3 py-2 rounded-full truncate text-center transition-colors',
                  isActive
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-amber-100'
                    : 'bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/40 hover:border-violet-400/65 text-violet-200 hover:text-white',
                ].join(' ')}
                title={`${county.name} County`}
                aria-label={`${county.name} County weather alerts`}
              >
                {county.name}
              </Link>
            );
          })}
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
      </div>
    </section>
  );
}
