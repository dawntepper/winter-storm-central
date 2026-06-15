import { trackStateQuickActionClicked } from '../../utils/analytics';

const ACTION_CLASS =
  'flex-1 min-w-[5.5rem] px-4 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-sky-500/40 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

/**
 * Above-the-fold quick actions for state alert pages.
 */
export default function StateQuickActions({ stateCode, onRadar, onSearch, onCounties }) {
  const track = (actionType) => {
    trackStateQuickActionClicked({ state: stateCode, actionType });
  };

  return (
    <nav
      aria-label="Quick actions"
      className="flex flex-wrap gap-2 mt-4"
    >
      <button
        type="button"
        onClick={() => {
          track('radar');
          onRadar?.();
        }}
        className={ACTION_CLASS}
      >
        Radar
      </button>
      <button
        type="button"
        onClick={() => {
          track('search');
          onSearch?.();
        }}
        className={ACTION_CLASS}
      >
        Search City
      </button>
      <button
        type="button"
        onClick={() => {
          track('counties');
          onCounties?.();
        }}
        className={ACTION_CLASS}
      >
        Counties
      </button>
    </nav>
  );
}
