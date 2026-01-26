/**
 * ActualAccumulations Component
 *
 * PREMIUM FEATURE: Displays actual observed snow accumulations
 * from ACIS weather stations and CoCoRaHS volunteers.
 *
 * Shows:
 * - Storm total snowfall (measured, not forecast)
 * - Current snow depth
 * - Daily breakdown
 * - Nearby station comparisons
 */

import { useState } from 'react';

function InfoTooltip({ text, position = 'top' }) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1'
  };

  return (
    <span className="relative group cursor-help ml-1">
      <span className="text-slate-500 hover:text-slate-400 text-[10px]">ⓘ</span>
      <span className={`absolute ${positionClasses[position]} px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-[200px] text-wrap`}>
        {text}
      </span>
    </span>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function SnowValue({ value, unit = '"' }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-500">--</span>;
  }
  if (value === 'T') {
    return <span className="text-sky-300/70 text-sm">Trace</span>;
  }
  return (
    <span className="text-sky-300 font-semibold">
      {typeof value === 'number' ? value.toFixed(1) : value}{unit}
    </span>
  );
}

function StationBadge({ name, distance }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span className="truncate">{name}</span>
      {distance && <span className="text-slate-500">({distance} mi)</span>}
    </div>
  );
}

/**
 * Compact accumulation display for city cards/tooltips
 */
export function AccumulationBadge({ stormTotal, snowDepth, stationName }) {
  if (stormTotal === null && snowDepth === null) {
    return null;
  }

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span className="text-[9px] text-emerald-400 font-medium uppercase">Actual</span>
        <InfoTooltip text="Through yesterday, updates ~7-9 AM" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-400">
            <SnowValue value={stormTotal} />
          </div>
          <div className="text-[8px] text-slate-500 uppercase">Storm Total</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400">
            <SnowValue value={snowDepth} />
          </div>
          <div className="text-[8px] text-slate-500 uppercase">Depth</div>
        </div>
      </div>
      {stationName && (
        <div className="text-[9px] text-slate-500 mt-1 truncate">
          via {stationName}
        </div>
      )}
    </div>
  );
}

/**
 * Full accumulation card with daily breakdown
 */
export function AccumulationCard({ data, cityName }) {
  const [showDetails, setShowDetails] = useState(false);

  if (!data?.primary) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="text-slate-500 text-sm text-center">
          No accumulation data available yet
        </div>
      </div>
    );
  }

  const { primary, nearby, stationCount } = data;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-emerald-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400">&#10003;</span>
              Actual Accumulations
            </h3>
            <p className="text-[10px] text-emerald-400/70 mt-0.5 flex items-center">
              Measured snowfall through yesterday
              <InfoTooltip text="Updates each morning ~7-9 AM with previous day's totals" />
            </p>
          </div>
          <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-medium px-2 py-1 rounded">
            PREMIUM
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              <SnowValue value={primary.stormTotal} />
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">
              Storm Total
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              <SnowValue value={primary.latestDepth} />
            </div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">
              Snow Depth
            </div>
          </div>
        </div>

        {/* Station Info */}
        <StationBadge name={primary.name} distance={primary.distance} />

        {/* Daily Breakdown Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-3 text-[11px] text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 py-2 border-t border-slate-700/50 cursor-pointer"
        >
          {showDetails ? 'Hide' : 'Show'} daily breakdown
          <svg
            className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Daily Breakdown */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
              Daily Snowfall
            </div>
            <div className="space-y-1.5">
              {primary.dailyData.map((day, i) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between text-xs bg-slate-900/30 rounded px-2 py-1.5"
                >
                  <span className="text-slate-400">{formatDate(day.date)}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 text-[10px]">Fell:</span>
                    <SnowValue value={day.snowfall} />
                    <span className="text-slate-500 text-[10px]">Depth:</span>
                    <SnowValue value={day.snowDepth} />
                  </div>
                </div>
              ))}
            </div>

            {/* Nearby Stations */}
            {nearby && nearby.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
                  Nearby Stations ({stationCount} total)
                </div>
                <div className="space-y-1">
                  {nearby.map(station => (
                    <div
                      key={station.name}
                      className="flex items-center justify-between text-[11px] text-slate-400"
                    >
                      <span className="truncate flex-1">{station.name}</span>
                      <span className="text-emerald-400 font-medium ml-2">
                        {station.stormTotal > 0 ? `${station.stormTotal}"` : '--'}
                      </span>
                      <span className="text-slate-500 ml-2 text-[10px]">
                        {station.distance} mi
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700/50">
        <p className="text-[9px] text-slate-500">
          Data from ACIS/NOAA • CoCoRaHS volunteers
          {primary.lastReport && ` • Last report: ${formatDate(primary.lastReport)}`}
        </p>
      </div>
    </div>
  );
}

/**
 * Leaderboard of actual accumulations
 */
export function AccumulationLeaderboard({ data, title = "Actual Storm Totals" }) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-emerald-500/30 overflow-hidden">
      <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400">&#10003;</span>
              {title}
            </h3>
            <p className="text-[10px] text-emerald-400/70 mt-0.5 flex items-center">
              Through yesterday
              <InfoTooltip text="Updates each morning ~7-9 AM with previous day's totals" />
            </p>
          </div>
          <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-medium px-2 py-1 rounded">
            MEASURED
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-700/50">
        {data.map((item, index) => (
          <div
            key={item.cityId}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? 'bg-amber-500/20 text-amber-400' :
                index === 1 ? 'bg-slate-400/20 text-slate-300' :
                index === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-slate-700/50 text-slate-400'
              }`}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <span className="text-slate-200 font-medium text-sm truncate block">
                  {item.cityName}
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  via {item.stationName}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <div className="text-emerald-400 font-bold">
                {item.stormTotal.toFixed(1)}"
              </div>
              {item.snowDepth && (
                <div className="text-[10px] text-slate-500">
                  {item.snowDepth}" depth
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700/50">
        <p className="text-[9px] text-slate-500 text-center">
          Actual measured snowfall from weather stations
        </p>
      </div>
    </div>
  );
}

export default AccumulationCard;
