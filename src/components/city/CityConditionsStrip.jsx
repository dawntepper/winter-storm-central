import {
  describeWeatherCode,
  degreesToCompass,
} from '../../utils/fetchOpenMeteoConditions';

function formatTemp(t) {
  return typeof t === 'number' ? `${Math.round(t)}°` : '—';
}

/**
 * Single-row current conditions — temp, icon, one-line summary for city hero.
 */
export default function CityConditionsStrip({ cityName, conditions, error }) {
  if (error) {
    return (
      <p className="text-sm text-slate-400">
        Current conditions unavailable — alerts and radar are still live.
      </p>
    );
  }

  if (!conditions) {
    return (
      <p className="text-sm text-slate-400">
        Loading conditions for {cityName}…
      </p>
    );
  }

  const { current } = conditions;
  const wx = describeWeatherCode(current.weatherCode);
  const windDir = degreesToCompass(current.windDirection);
  const windPart = typeof current.windSpeed === 'number'
    ? `Wind ${Math.round(current.windSpeed)} mph${windDir ? ` ${windDir}` : ''}`
    : null;
  const uvPart = typeof current.uvIndex === 'number'
    ? `UV ${Math.round(current.uvIndex)}`
    : null;
  const detailParts = [windPart, uvPart].filter(Boolean);
  const detailsLine = detailParts.join(' · ');

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-200"
      aria-label={`Current conditions for ${cityName}`}
    >
      <span className="inline-flex items-center gap-2 font-semibold text-white">
        <span className="text-xl leading-none" aria-hidden="true">{wx.icon}</span>
        <span className="text-lg">{formatTemp(current.temperature)}</span>
        <span className="font-normal text-slate-300">{wx.label}</span>
      </span>
      {detailsLine && (
        <>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">{detailsLine}</span>
        </>
      )}
    </div>
  );
}
