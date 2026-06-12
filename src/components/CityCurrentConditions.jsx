import {
  describeWeatherCode,
  degreesToCompass,
} from '../utils/fetchOpenMeteoConditions';

function formatTemp(t) {
  return typeof t === 'number' ? `${Math.round(t)}°` : '—';
}

function formatDateShort(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

/**
 * Open-Meteo current conditions card — shared by static and catalog city alert pages.
 */
export default function CityCurrentConditions({ cityName, conditions, error }) {
  if (error) {
    return (
      <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col h-full">
        <p className="text-slate-400 text-sm">
          Current conditions are temporarily unavailable. Active alerts below are still live from the National Weather Service.
        </p>
      </section>
    );
  }
  if (!conditions) {
    return (
      <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex flex-col h-full">
        <p className="text-slate-400 text-sm">Loading current conditions for {cityName}…</p>
      </section>
    );
  }

  const { current, daily, fetchedAt } = conditions;
  const wx = describeWeatherCode(current.weatherCode);
  const windDir = degreesToCompass(current.windDirection);

  return (
      <section className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Current Conditions
        </h2>
        <span className="text-xs text-slate-500">
          Updated {formatDateTime(fetchedAt)}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex items-center gap-4">
          <span className="text-5xl" aria-hidden="true">{wx.icon}</span>
          <div>
            <p className="text-5xl font-bold text-white leading-none">
              {formatTemp(current.temperature)}<span className="text-2xl text-slate-400">F</span>
            </p>
            <p className="text-sm text-slate-300 mt-1">{wx.label}</p>
            {typeof current.apparentTemperature === 'number' && (
              <p className="text-xs text-slate-500 mt-0.5">
                Feels like {formatTemp(current.apparentTemperature)}F
              </p>
            )}
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Metric label="Humidity" value={typeof current.humidity === 'number' ? `${Math.round(current.humidity)}%` : '—'} />
          <Metric label="Wind" value={typeof current.windSpeed === 'number' ? `${Math.round(current.windSpeed)} mph ${windDir}` : '—'} />
          <Metric label="Gusts" value={typeof current.windGusts === 'number' ? `${Math.round(current.windGusts)} mph` : '—'} />
          <Metric label="UV Index" value={typeof current.uvIndex === 'number' ? current.uvIndex.toFixed(1) : '—'} />
        </div>
      </div>

      {daily && daily.length > 0 && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {daily.slice(0, 4).map((d, i) => {
              const dw = describeWeatherCode(d.weatherCode);
              return (
                <div key={d.date || i} className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">{i === 0 ? 'Today' : formatDateShort(d.date)}</p>
                  <p className="text-2xl my-1" aria-hidden="true">{dw.icon}</p>
                  <p className="text-sm font-medium text-white">
                    {formatTemp(d.tempMax)} <span className="text-slate-500">/ {formatTemp(d.tempMin)}</span>
                  </p>
                  {typeof d.precipChance === 'number' && (
                    <p className="text-[11px] text-sky-400 mt-1">
                      {Math.round(d.precipChance)}% precip
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
