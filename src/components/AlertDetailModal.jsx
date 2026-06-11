/**
 * Full-screen alert detail popup — shared by state/county alert pages and search.
 */
export default function AlertDetailModal({ alert, onClose }) {
  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 max-w-lg w-full max-h-[80vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-white">{alert.event}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
              {alert.severity}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">
              {alert.urgency}
            </span>
          </div>

          <p className="text-slate-300">{alert.location}</p>

          {alert.headline && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Headline</h4>
              <p className="text-slate-300 text-sm leading-relaxed">{alert.headline}</p>
            </div>
          )}

          {alert.fullDescription && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Details</h4>
              <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">
                {alert.fullDescription}
              </p>
            </div>
          )}

          {alert.areaDesc && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-1">Affected Areas</h4>
              <p className="text-slate-400 text-sm">{alert.areaDesc}</p>
            </div>
          )}

          <div className="flex gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
            {alert.onset && <span>Onset: {new Date(alert.onset).toLocaleString()}</span>}
            {alert.expires && <span>Expires: {new Date(alert.expires).toLocaleString()}</span>}
          </div>

          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-sky-400 hover:underline"
            >
              View on weather.gov →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
