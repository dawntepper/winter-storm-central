import { Link } from 'react-router-dom';

export default function AffectedStatesSection({ hazard, onStateClick }) {
  const states = hazard?.affectedStates || [];

  if (states.length === 0) {
    return (
      <section aria-labelledby="affected-states-heading" className="mt-10">
        <h2 id="affected-states-heading" className="text-lg font-semibold text-white mb-2">
          Browse Weather Alerts by State
        </h2>
        <p className="text-sm text-slate-400 mb-3">
          No states currently have active {hazard.pluralLabel?.toLowerCase()}. Browse alerts by state:
        </p>
        <Link to="/alerts" className="text-sm text-sky-400 hover:underline">
          View all live weather alerts →
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="affected-states-heading" className="mt-10">
      <h2 id="affected-states-heading" className="text-lg font-semibold text-white mb-3">
        Affected States
      </h2>
      <ul className="grid sm:grid-cols-2 gap-2">
        {states.map((state) => (
          <li key={state.code}>
            <Link
              to={state.href}
              onClick={() => onStateClick?.(state)}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-2.5 text-sm hover:border-sky-500/40 transition-colors"
            >
              <span className="text-slate-200 font-medium">{state.name} Weather Alerts</span>
              <span className="text-xs text-slate-500 tabular-nums">
                {state.alertCount} alert{state.alertCount === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
