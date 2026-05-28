import { useMemo } from 'react';
import { TemperatureSparkline, PrecipitationStrip, WindCompass } from './ForecastVisuals';

/**
 * Shared forecast UI sections — used by both /forecast/[state-slug] (top-level
 * forecast page) and CityAlertsPage (inline section under the alerts list).
 *
 * Each section accepts the relevant slice of the data returned by
 * forecastService.getForecastForCoords(). Components are intentionally
 * presentational — they don't fetch or own state; the caller does.
 */

/**
 * Current conditions card. Renders icon + big temp, with a wind compass
 * to the right and a 24h temperature sparkline below — gives the user
 * "where today is going" at a glance.
 *
 * @param {Object} props
 * @param {Object} props.current   The first hourly period (proxy for "now")
 * @param {Object[]} [props.hourly] Hourly periods (for the sparkline). Optional —
 *   the card still renders without it; the sparkline section is skipped.
 * @param {string} [props.location] Display name shown in the wind footnote.
 */
export function ForecastCurrent({ current, hourly, location }) {
  if (!current) return null;
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Right now</h2>
        <a
          href="#forecast-7day"
          className="text-xs text-sky-400 hover:text-sky-300 font-medium whitespace-nowrap"
        >
          7-day outlook ↓
        </a>
      </div>
      <div className="flex items-start gap-4">
        {current.icon && (
          <img src={current.icon} alt="" className="w-20 h-20 rounded-lg flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-bold text-white">
              {current.temperature}°{current.temperatureUnit || 'F'}
            </span>
          </div>
          <p className="text-base text-slate-300 mt-1">{current.shortForecast}</p>
          {location && (
            <p className="text-xs text-slate-500 mt-2 truncate">{location}</p>
          )}
        </div>
        {current.windDirection && (
          <WindCompass direction={current.windDirection} speed={current.windSpeed} />
        )}
      </div>
      {hourly && hourly.length >= 2 && (
        <div className="mt-auto pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Next 24h trend</span>
          </div>
          <TemperatureSparkline periods={hourly} />
        </div>
      )}
    </section>
  );
}

export function ForecastHourly({ periods, timeZone, title = 'Next 24 hours' }) {
  if (!periods || periods.length === 0) return null;
  const next24 = periods.slice(0, 24);
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', timeZone: timeZone || undefined });
  };
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</h2>
        <span className="text-[10px] text-slate-500">
          {periods.length} hourly periods total (~{Math.round(periods.length / 24)} days)
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {next24.map((p) => (
          <div
            key={p.startTime}
            className="flex-shrink-0 w-20 bg-slate-900/60 border border-slate-700 rounded-lg p-2 flex flex-col items-center text-center"
          >
            <span className="text-[10px] text-slate-400 mb-1">{fmt(p.startTime)}</span>
            {p.icon && <img src={p.icon} alt="" className="w-10 h-10" />}
            <span className="text-sm font-semibold text-white mt-1">{p.temperature}°</span>
            {p.probabilityOfPrecipitation?.value != null && p.probabilityOfPrecipitation.value > 0 && (
              <span className="text-[10px] text-sky-400 mt-0.5">{p.probabilityOfPrecipitation.value}%</span>
            )}
          </div>
        ))}
      </div>
      <PrecipitationStrip periods={next24} />
    </section>
  );
}

export function ForecastDaily({ periods, title = '7-day outlook' }) {
  const days = useMemo(() => groupPeriodsIntoDays(periods || []), [periods]);
  if (days.length === 0) return null;
  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</h2>
      <div className="space-y-2">
        {days.map((d) => (
          <div key={d.key} className="flex items-start gap-3 sm:gap-4 p-3 bg-slate-900/40 border border-slate-700 rounded-lg">
            <div className="w-20 sm:w-28 flex-shrink-0">
              <p className="text-base font-semibold text-white">{d.dayName}</p>
              <p className="text-xs text-slate-400">{d.dateLabel}</p>
            </div>
            {d.day?.icon ? (
              <img src={d.day.icon} alt="" className="w-12 h-12 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-slate-100">
                {d.day?.shortForecast || d.night?.shortForecast || '—'}
              </p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {d.day?.detailedForecast || d.night?.detailedForecast || ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-base font-semibold text-white">{d.high != null ? `${d.high}°` : '—'}</p>
              <p className="text-sm text-slate-400">{d.low != null ? `${d.low}°` : '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * NWS daily forecast returns alternating day/night periods (~14 total over 7 days).
 * Group them by calendar date with a high (day) + low (night) summary.
 */
function groupPeriodsIntoDays(periods) {
  const byDay = new Map();
  for (const p of periods) {
    const start = new Date(p.startTime);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    if (!byDay.has(key)) {
      const dayName = start.toLocaleDateString(undefined, { weekday: 'long' });
      const dateLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      byDay.set(key, { key, dayName, dateLabel, day: null, night: null, high: null, low: null });
    }
    const bucket = byDay.get(key);
    if (p.isDaytime) {
      bucket.day = p;
      bucket.high = p.temperature;
    } else {
      bucket.night = p;
      bucket.low = p.temperature;
    }
  }
  return Array.from(byDay.values());
}
