export default function Header({ lastRefresh, onRefresh, loading, stormPhase }) {
  const phaseLabels = {
    'pre-storm': 'Forecast Mode',
    'active': 'Storm Active',
    'post-storm': 'Storm Complete'
  };

  const phaseColors = {
    'pre-storm': 'bg-slate-600',
    'active': 'bg-emerald-600',
    'post-storm': 'bg-slate-500'
  };

  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-3xl text-slate-300">&#10052;</div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Winter Storm Central
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-400 text-sm">
                Jan 24-26, 2026
              </p>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${phaseColors[stormPhase]} text-white`}>
                {phaseLabels[stormPhase]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-slate-400">
            {lastRefresh && (
              <p>Updated {lastRefresh.toLocaleTimeString()}</p>
            )}
            <p className="text-xs text-slate-500">Auto-refresh every 30 min</p>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                       disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium
                       transition-colors flex items-center gap-2 border border-slate-600"
          >
            {loading ? (
              <>
                <span className="animate-spin">&#8635;</span>
                Loading...
              </>
            ) : (
              <>
                <span>&#8635;</span>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
