import { trackRadarLinkClick, NAV_SOURCES } from '../../utils/analytics';

/**
 * Compact radar promotion above the city list.
 */
export default function RadarPromotionCard({ stateName, onOpenRadar }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5">
      <p className="text-sm text-slate-300 leading-relaxed">
        <span className="font-semibold text-white">Live Radar</span>
        {' — '}
        View precipitation and storm activity across {stateName}.
      </p>
      <button
        type="button"
        onClick={() => {
          trackRadarLinkClick(NAV_SOURCES.STATE_PAGE_RADAR_LINK);
          onOpenRadar?.();
        }}
        className="shrink-0 px-4 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
      >
        Open Radar
      </button>
    </div>
  );
}
