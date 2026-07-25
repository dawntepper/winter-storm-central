/**
 * WeatherBriefSection — editorial brief from Hazard Engine (never invents counts).
 */
export default function WeatherBriefSection({ weatherBrief, briefLoading, compact = false }) {
  const summary = weatherBrief?.summary;
  const shell = compact
    ? 'rounded-xl border border-slate-700/80 bg-slate-900/60 p-3.5'
    : '';

  if (!summary && briefLoading) {
    return (
      <section
        aria-labelledby="weather-brief-heading"
        className={compact ? shell : 'mt-6'}
      >
        <h2
          id="weather-brief-heading"
          className={`font-semibold text-white mb-2 ${compact ? 'text-xs uppercase tracking-wider text-slate-400' : 'text-lg'}`}
        >
          Weather Brief
        </h2>
        <p className="text-sm text-slate-400" role="status">Loading weather brief…</p>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section
      aria-labelledby="weather-brief-heading"
      className={compact ? shell : 'mt-6'}
    >
      <h2
        id="weather-brief-heading"
        className={
          compact
            ? 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2'
            : 'text-lg font-semibold text-white mb-2'
        }
      >
        Weather Brief
      </h2>
      <p className={`text-slate-300 leading-relaxed ${compact ? 'text-sm' : 'text-[15px] sm:text-base max-w-3xl'}`}>
        {summary}
      </p>
      {weatherBrief?.notableChange && (
        <p className={`mt-2 text-slate-400 leading-relaxed ${compact ? 'text-xs' : 'text-sm max-w-3xl'}`}>
          {weatherBrief.notableChange}
        </p>
      )}
      {weatherBrief?.generatedAt && weatherBrief.source !== 'fallback' && (
        <p className="mt-2 text-xs text-slate-500">
          Brief updated{' '}
          <time dateTime={weatherBrief.generatedAt}>
            {new Date(weatherBrief.generatedAt).toLocaleString()}
          </time>
          {weatherBrief.source === 'manual' ? ' (editorial)' : ''}
        </p>
      )}
    </section>
  );
}
