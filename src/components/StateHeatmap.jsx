import { useMemo, useState } from 'react';
import { STATE_NAMES } from '../data/stateConfig';
import { ALERT_CATEGORIES } from '../../shared/nws-alert-parser';

// Compact US grid layout — approximate geographic positions
// Each entry: [row, col, abbr]
const US_GRID = [
  [0, 10, 'ME'],
  [1, 0, 'WA'], [1, 1, 'MT'], [1, 2, 'ND'], [1, 3, 'MN'], [1, 5, 'WI'], [1, 8, 'MI'], [1, 9, 'VT'], [1, 10, 'NH'],
  [2, 0, 'OR'], [2, 1, 'ID'], [2, 2, 'SD'], [2, 3, 'IA'], [2, 5, 'IL'], [2, 6, 'IN'], [2, 7, 'OH'], [2, 8, 'PA'], [2, 9, 'NY'], [2, 10, 'MA'], [2, 11, 'CT'],
  [3, 0, 'CA'], [3, 1, 'NV'], [3, 2, 'WY'], [3, 3, 'NE'], [3, 4, 'MO'], [3, 5, 'KY'], [3, 6, 'WV'], [3, 7, 'VA'], [3, 8, 'MD'], [3, 9, 'NJ'], [3, 10, 'RI'],
  [4, 1, 'UT'], [4, 2, 'CO'], [4, 3, 'KS'], [4, 4, 'AR'], [4, 5, 'TN'], [4, 6, 'NC'], [4, 7, 'SC'], [4, 9, 'DE'],
  [5, 1, 'AZ'], [5, 2, 'NM'], [5, 3, 'OK'], [5, 4, 'LA'], [5, 5, 'MS'], [5, 6, 'AL'], [5, 7, 'GA'], [5, 8, 'FL'],
  [6, 3, 'TX'],
  [7, 0, 'AK'], [7, 1, 'HI'],
];

const GRID_ROWS = 8;
const GRID_COLS = 12;

function getIntensityColor(count, maxCount) {
  if (count === 0) return 'rgba(51, 65, 85, 0.3)';
  const ratio = Math.min(count / Math.max(maxCount, 1), 1);
  if (ratio < 0.25) return `rgba(34, 197, 94, ${0.4 + ratio * 2})`;
  if (ratio < 0.5) return `rgba(234, 179, 8, ${0.5 + ratio})`;
  if (ratio < 0.75) return `rgba(249, 115, 22, ${0.6 + ratio * 0.4})`;
  return `rgba(239, 68, 68, ${0.7 + ratio * 0.3})`;
}

/**
 * Get border style for a state based on its alert categories.
 * Single category: solid border in that color.
 * Multiple categories: 2px dashed border using dominant color.
 */
function getStateBorder(info) {
  if (!info || info.count === 0) return { border: '1px solid rgba(51, 65, 85, 0.2)' };

  const catEntries = Object.entries(info.categories).sort(([, a], [, b]) => b - a);
  const topCat = ALERT_CATEGORIES[catEntries[0][0]];
  const color = topCat?.color || '#94a3b8';
  const multiCat = catEntries.length > 1;

  return {
    border: multiCat ? `1.5px dashed ${color}` : `1.5px solid ${color}`,
  };
}

export default function StateHeatmap({ alerts, loading, onStateZoom }) {
  const [hoveredState, setHoveredState] = useState(null);

  const { stateData, maxCount, totalAlerts } = useMemo(() => {
    const allAlerts = alerts?.allAlerts || [];
    const data = {};
    let max = 0;

    for (const a of allAlerts) {
      if (!a.state) continue;
      if (!data[a.state]) {
        data[a.state] = { count: 0, categories: {} };
      }
      data[a.state].count++;
      data[a.state].categories[a.category] = (data[a.state].categories[a.category] || 0) + 1;
      if (data[a.state].count > max) max = data[a.state].count;
    }

    return { stateData: data, maxCount: max, totalAlerts: allAlerts.length };
  }, [alerts]);

  const tooltipInfo = useMemo(() => {
    if (!hoveredState) return null;
    const info = stateData[hoveredState];
    const name = STATE_NAMES[hoveredState] || hoveredState;
    if (!info) return { name, count: 0, categories: [] };

    const cats = Object.entries(info.categories)
      .sort(([, a], [, b]) => b - a)
      .map(([catId, count]) => {
        const cat = ALERT_CATEGORIES[catId];
        return cat ? `${cat.icon} ${count}` : null;
      })
      .filter(Boolean);

    return { name, count: info.count, categories: cats };
  }, [hoveredState, stateData]);

  if (loading && !alerts) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 border-l-4 border-l-sky-500 p-4">
        <div className="h-5 w-32 bg-slate-700 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-12 gap-0.5">
          {[...Array(40)].map((_, i) => (
            <div key={i} className="h-5 bg-slate-700/40 rounded-sm animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="alert-heatmap" className="bg-slate-800/50 rounded-xl border border-slate-700 border-l-4 border-l-sky-500 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">Alert Heatmap</h3>
        <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
          {totalAlerts} active
        </span>
      </div>

      {/* Tooltip — fixed height to prevent layout shift */}
      <div className="h-10 mb-1">
        {tooltipInfo ? (
          <div className="px-2 py-1.5 rounded bg-slate-900/80 border border-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                {tooltipInfo.name}
                {tooltipInfo.count > 0 && (
                  <span className="text-slate-500 font-normal ml-1">— click to view on map</span>
                )}
              </span>
              <span className="text-xs text-slate-400">
                {tooltipInfo.count > 0
                  ? `${tooltipInfo.count} alert${tooltipInfo.count !== 1 ? 's' : ''}`
                  : 'No alerts'}
              </span>
            </div>
            {tooltipInfo.categories.length > 0 && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                {tooltipInfo.categories.join('  ')}
              </div>
            )}
          </div>
        ) : (
          <div className="px-2 py-1.5 text-[10px] text-slate-600 text-center">
            Hover a state for details — click to view on map
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        }}
      >
        {US_GRID.map(([row, col, abbr]) => {
          const info = stateData[abbr];
          const count = info?.count || 0;
          const color = getIntensityColor(count, maxCount);
          const isHovered = hoveredState === abbr;
          const borderStyle = getStateBorder(info);
          const catCount = info ? Object.keys(info.categories).length : 0;

          // Get dominant category color for hover outline
          let hoverColor = '#94a3b8';
          if (info && count > 0) {
            const topCat = Object.entries(info.categories).sort(([, a], [, b]) => b - a)[0];
            if (topCat) {
              const cat = ALERT_CATEGORIES[topCat[0]];
              if (cat) hoverColor = cat.color;
            }
          }

          return (
            <button
              key={abbr}
              className="rounded-sm text-center cursor-pointer"
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
                backgroundColor: isHovered ? undefined : color,
                background: isHovered ? `linear-gradient(135deg, ${color}, ${hoverColor}40)` : undefined,
                ...(isHovered
                  ? { outline: `2px solid ${hoverColor}`, outlineOffset: '-1px' }
                  : borderStyle),
                padding: '2px 0',
                position: 'relative',
                zIndex: isHovered ? 10 : 1,
              }}
              onMouseEnter={() => setHoveredState(abbr)}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => onStateZoom?.(abbr)}
            >
              <span
                className="text-[8px] font-bold leading-none"
                style={{
                  color: count > 0 || isHovered ? '#fff' : '#64748b',
                  textShadow: count > 0 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {abbr}
              </span>
              {/* Multi-category indicator dot */}
              {catCount > 1 && !isHovered && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#fff', opacity: 0.7 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-2.5 px-1">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600">fewer</span>
          <div className="flex gap-px">
            {[0, 0.25, 0.5, 0.75, 1].map((r) => (
              <div
                key={r}
                className="w-3 h-2 rounded-sm"
                style={{ backgroundColor: getIntensityColor(r * 10, 10) }}
              />
            ))}
          </div>
          <span className="text-[9px] text-slate-600">more</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm" style={{ border: '1.5px solid #3b82f6' }} />
            <span className="text-[9px] text-slate-600">1 type</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm" style={{ border: '1.5px dashed #3b82f6' }} />
            <span className="text-[9px] text-slate-600">mixed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
