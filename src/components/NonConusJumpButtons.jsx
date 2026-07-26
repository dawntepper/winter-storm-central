/**
 * Compact Alaska / Hawaii jump controls — pan the existing map (no inset maps).
 * Distinct colors: blue for Alaska, green for Hawaii.
 */

const BASE_PILL =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer focus:outline-none whitespace-nowrap shrink-0';

const ALASKA_PILL =
  `${BASE_PILL} bg-sky-500/20 text-sky-300 border-sky-500/45 hover:bg-sky-500/30 hover:text-sky-200 focus:ring-2 focus:ring-sky-500/40`;

const HAWAII_PILL =
  `${BASE_PILL} bg-emerald-500/20 text-emerald-300 border-emerald-500/45 hover:bg-emerald-500/30 hover:text-emerald-200 focus:ring-2 focus:ring-emerald-500/40`;

export default function NonConusJumpButtons({ onJump, className = '' }) {
  return (
    <div
      className={`flex items-center gap-1.5 shrink-0 ${className}`.trim()}
      role="group"
      aria-label="Jump map to Alaska or Hawaii"
    >
      <button
        type="button"
        onClick={() => onJump?.('AK')}
        className={ALASKA_PILL}
        aria-label="Jump map to Alaska"
        title="Pan map to Alaska"
      >
        Alaska
      </button>
      <button
        type="button"
        onClick={() => onJump?.('HI')}
        className={HAWAII_PILL}
        aria-label="Jump map to Hawaii"
        title="Pan map to Hawaii"
      >
        Hawaii
      </button>
    </div>
  );
}
