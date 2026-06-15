import useStatePageGeolocation from './useStatePageGeolocation';

function CrosshairIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function NavigationIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

/**
 * Prominent above-the-fold "Use My Location" bar for state alert pages.
 */
export default function StateUseMyLocationBar({ stateCode }) {
  const { handleUseMyLocation, isLocating, error, gpsMessage } = useStatePageGeolocation(stateCode);

  return (
    <section className="mt-4" aria-label="Use my location">
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={isLocating}
        className="flex w-full flex-col gap-4 rounded-xl border border-sky-500/40 bg-gradient-to-r from-sky-600/20 to-sky-500/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 text-left transition-colors hover:border-sky-400/60 hover:from-sky-600/25 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/25 text-sky-300">
            <CrosshairIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-base sm:text-lg font-bold text-white">Use My Location</p>
            <p className="mt-0.5 text-sm text-slate-300 leading-snug">
              Get weather alerts and forecasts for your exact location
            </p>
          </div>
        </div>
        <span className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3.5 text-sm font-semibold text-white sm:min-w-[11rem]">
          <NavigationIcon className="h-4 w-4" />
          {isLocating ? 'Locating…' : 'Use My Location'}
        </span>
      </button>
      {(gpsMessage || error) && (
        <p className="mt-2 text-xs sm:text-sm text-amber-400 px-1">{error || gpsMessage}</p>
      )}
    </section>
  );
}
