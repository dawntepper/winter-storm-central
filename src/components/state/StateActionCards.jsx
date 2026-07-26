import { trackStateQuickActionClicked } from '../../utils/analytics';

/**
 * Compact mobile-only jump nav for state alert pages.
 * Desktop already exposes radar / city / county inline — do not show cards there.
 */
export default function StateActionCards({ stateCode, stateName, onRadar, onSelectCity, onCounties }) {
  const track = (actionType) => {
    trackStateQuickActionClicked({ state: stateCode, actionType });
  };

  const itemClass =
    'inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/70 px-2 text-xs font-semibold text-slate-200 transition-colors cursor-pointer hover:bg-slate-800 hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50';

  return (
    <nav
      aria-label={`${stateName} page shortcuts`}
      className="mt-3 grid grid-cols-3 gap-2 lg:hidden"
    >
      <button
        type="button"
        onClick={() => {
          track('radar');
          onRadar?.();
        }}
        className={itemClass}
        aria-label={`Jump to ${stateName} radar map`}
      >
        <span aria-hidden="true">🌀</span>
        Radar
      </button>
      <button
        type="button"
        onClick={() => {
          track('city');
          onSelectCity?.();
        }}
        className={itemClass}
        aria-label={`Jump to find local weather by city in ${stateName}`}
      >
        <span aria-hidden="true">🏙</span>
        City
      </button>
      <button
        type="button"
        onClick={() => {
          track('county');
          onCounties?.();
        }}
        className={itemClass}
        aria-label={`Jump to ${stateName} counties`}
      >
        <span aria-hidden="true">🗺</span>
        Counties
      </button>
    </nav>
  );
}
