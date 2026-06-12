import { ForecastCurrent } from '../ForecastSections';
import { useCityForecast } from '../../hooks/useCityForecast';

/**
 * ForecastPage-style "Right Now" card for city alert dashboards.
 */
export default function CityRightNowCard({ lat, lon, locationName, cityName }) {
  const { forecast, loading } = useCityForecast(lat, lon);

  if (loading && !forecast) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
        <p className="text-sm text-slate-400">Loading current conditions…</p>
      </div>
    );
  }

  if (!forecast?.current) {
    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-center min-h-[120px]">
        <p className="text-sm text-slate-400">
          Current conditions unavailable — alerts and radar are still live.
        </p>
      </div>
    );
  }

  return (
    <ForecastCurrent
      current={forecast.current}
      hourly={forecast.hourly}
      location={locationName || cityName}
    />
  );
}
