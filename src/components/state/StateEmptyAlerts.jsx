/**
 * Empty statewide alert messaging with helpful next-step actions.
 */
export default function StateEmptyAlerts({ stateName, onViewRadar, onSelectCity }) {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-8 text-center">
      <p className="text-lg font-medium text-emerald-400 mb-2">
        No active statewide alerts.
      </p>
      <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto leading-relaxed">
        Check local weather conditions, radar, and forecasts for your city.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onViewRadar}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          View State Radar
        </button>
        <button
          type="button"
          onClick={onSelectCity}
          className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          Select a City
        </button>
      </div>
    </div>
  );
}
