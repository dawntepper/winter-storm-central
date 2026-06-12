import CitySaveLocationToggle from './CitySaveLocationToggle';
import { useCityForecast } from '../../hooks/useCityForecast';

/**
 * Compact forecast-first hero — city name, current temp/conditions, save toggle.
 * Alert summary lives in CityActiveAlertBanner below (not duplicated here).
 */
export default function CityCompactHero({
  cityName,
  stateCode,
  lat,
  lon,
  citySlug,
}) {
  const { forecast, loading } = useCityForecast(lat, lon);
  const current = forecast?.current;

  let conditionsLine = null;
  if (loading && !current) {
    conditionsLine = (
      <p className="text-lg text-slate-400">Loading conditions…</p>
    );
  } else if (current) {
    conditionsLine = (
      <p className="text-2xl sm:text-3xl font-semibold text-white">
        {current.temperature}°{current.temperatureUnit || 'F'}{' '}
        <span className="font-normal text-slate-300">{current.shortForecast}</span>
      </p>
    );
  } else {
    conditionsLine = (
      <p className="text-lg text-slate-400">Conditions unavailable</p>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          {cityName}{stateCode ? `, ${stateCode}` : ''}
        </h1>
        {conditionsLine}
      </div>
      <CitySaveLocationToggle
        locationName={`${cityName}${stateCode ? `, ${stateCode}` : ''}`}
        lat={lat}
        lon={lon}
        citySlug={citySlug}
        stateCode={stateCode}
        variant="inline"
      />
    </div>
  );
}
