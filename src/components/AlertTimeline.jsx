import { useMemo, useState, useRef } from 'react';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../../shared/nws-alert-parser';

const MAX_BARS_PER_ROW = 20;
const MAX_LANES = 4;
const LANE_HEIGHT = 6; // px per lane
const LANE_GAP = 1;

function getBarPosition(onset, expires, windowStart, windowEnd) {
  const windowMs = windowEnd - windowStart;
  const startMs = Math.max(onset - windowStart, 0);
  const endMs = Math.min(expires - windowStart, windowMs);
  if (endMs <= startMs) return null;
  return {
    left: (startMs / windowMs) * 100,
    width: ((endMs - startMs) / windowMs) * 100,
    startMs,
    endMs,
  };
}

/**
 * Assign bars to non-overlapping swim lanes.
 * Each lane tracks the rightmost edge (in %) so far.
 */
function assignLanes(bars) {
  const sorted = [...bars].sort((a, b) => a.left - b.left);
  const laneEnds = []; // tracks the right edge of the last bar in each lane

  for (const bar of sorted) {
    let assigned = false;
    for (let i = 0; i < laneEnds.length && i < MAX_LANES; i++) {
      if (bar.left >= laneEnds[i]) {
        bar.lane = i;
        laneEnds[i] = bar.left + bar.width;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      if (laneEnds.length < MAX_LANES) {
        bar.lane = laneEnds.length;
        laneEnds.push(bar.left + bar.width);
      } else {
        // Overflow — put in the lane with the smallest end
        const minIdx = laneEnds.indexOf(Math.min(...laneEnds));
        bar.lane = minIdx;
        laneEnds[minIdx] = bar.left + bar.width;
      }
    }
  }

  const laneCount = Math.min(laneEnds.length, MAX_LANES);
  return { bars: sorted, laneCount: Math.max(laneCount, 1) };
}

function filterAlertsInWindow(alerts, windowStart, windowEnd) {
  return alerts.filter((a) => {
    if (!a.onset || !a.expires) return false;
    const onset = new Date(a.onset).getTime();
    const expires = new Date(a.expires).getTime();
    return expires > windowStart && onset < windowEnd;
  });
}

function getDayRelativeLabel(date, now) {
  const d = new Date(date);
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  const tomorrow = new Date(now + 86400000);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, yesterday)) return 'Yesterday';
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTimeAxisLabels(windowStart, windowEnd, now) {
  const labels = [];
  const windowMs = windowEnd - windowStart;

  // Day boundary labels (midnight lines)
  const cursor = new Date(windowStart);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  const dayBoundaries = [];
  while (cursor.getTime() < windowEnd) {
    const pct = ((cursor.getTime() - windowStart) / windowMs) * 100;
    if (pct > 2 && pct < 98) {
      dayBoundaries.push({
        pct,
        label: getDayRelativeLabel(cursor.getTime(), now),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // 6-hour interval labels
  const start = new Date(windowStart);
  const firstHour = Math.ceil(start.getHours() / 6) * 6;
  const timeCursor = new Date(start);
  timeCursor.setMinutes(0, 0, 0);
  timeCursor.setHours(firstHour);

  while (timeCursor.getTime() < windowEnd) {
    const pct = ((timeCursor.getTime() - windowStart) / windowMs) * 100;
    if (pct > 2 && pct < 98) {
      const h = timeCursor.getHours();
      if (h !== 0) {
        const ampm = h >= 12 ? 'p' : 'a';
        const display = h > 12 ? `${h - 12}${ampm}` : `${h}${ampm}`;
        labels.push({ pct, label: display });
      }
    }
    timeCursor.setHours(timeCursor.getHours() + 6);
  }

  return { timeLabels: labels, dayLabels: dayBoundaries };
}

function formatTimeRange(onset, expires) {
  const fmt = (d) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  return `${fmt(onset)} – ${fmt(expires)}`;
}

export default function AlertTimeline({ alerts, loading, filter, onAlertTap, onHoverAlert, onLeaveAlert }) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const { nowPct, timeLabels, dayLabels, rows, totalInWindow } = useMemo(() => {
    const now = Date.now();
    const wStart = now - 24 * 60 * 60 * 1000;
    const wEnd = now + 24 * 60 * 60 * 1000;
    const nPct = ((now - wStart) / (wEnd - wStart)) * 100;
    const { timeLabels: tLabels, dayLabels: dLabels } = getTimeAxisLabels(wStart, wEnd, now);

    let allAlerts = alerts?.allAlerts || [];
    if (filter) {
      allAlerts = allAlerts.filter((a) => a.state === filter);
    }

    const categoryRows = [];
    let total = 0;

    for (const catId of CATEGORY_ORDER) {
      const cat = ALERT_CATEGORIES[catId];
      const catAlerts = allAlerts.filter((a) => a.category === catId);
      const inWindow = filterAlertsInWindow(catAlerts, wStart, wEnd).slice(0, MAX_BARS_PER_ROW);
      if (inWindow.length === 0) continue;

      const rawBars = [];
      for (const a of inWindow) {
        const pos = getBarPosition(
          new Date(a.onset).getTime(),
          new Date(a.expires).getTime(),
          wStart,
          wEnd
        );
        if (pos) {
          rawBars.push({
            id: a.id,
            left: pos.left,
            width: pos.width,
            event: a.event,
            location: a.location || '',
            timeRange: formatTimeRange(a.onset, a.expires),
            color: cat.color,
            alert: a,
          });
        }
      }

      if (rawBars.length > 0) {
        const { bars, laneCount } = assignLanes(rawBars);
        total += bars.length;
        categoryRows.push({ catId, icon: cat.icon, name: cat.name, bars, laneCount, count: catAlerts.length });
      }
    }

    return { nowPct: nPct, timeLabels: tLabels, dayLabels: dLabels, rows: categoryRows, totalInWindow: total };
  }, [alerts, filter]);

  const handleBarEnter = (e, bar) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const barRect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      text: `${bar.event}${bar.location ? ` — ${bar.location}` : ''}`,
      time: bar.timeRange,
      x: barRect.left + barRect.width / 2 - rect.left,
      y: barRect.top - rect.top - 4,
    });
    onHoverAlert?.(bar.alert.id);
  };

  const handleBarLeave = () => {
    setTooltip(null);
    onLeaveAlert?.();
  };

  const handleBarClick = (bar) => {
    onAlertTap?.(bar.alert);
  };

  if (loading && !alerts) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-28 bg-slate-700 rounded animate-pulse" />
          <div className="h-5 w-10 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-6 bg-slate-700 rounded animate-pulse" />
          <div className="h-6 bg-slate-700 rounded animate-pulse" />
          <div className="h-6 bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Alert Timeline</h3>
          <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">48h</span>
        </div>
        <p className="text-xs text-slate-500 text-center py-3">No timed alerts in this window</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 relative" ref={containerRef}>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 shadow-xl"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
            maxWidth: '240px',
          }}
        >
          <div className="text-[11px] text-slate-200 font-medium leading-tight">{tooltip.text}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{tooltip.time}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-300">Alert Timeline</h3>
        <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
          {totalInWindow} alert{totalInWindow !== 1 ? 's' : ''} in 48h
        </span>
      </div>
      <p className="text-[10px] text-slate-600 mb-3">
        When alerts start and expire — each bar is one alert
      </p>

      {/* Day labels row */}
      <div className="relative h-3.5 mb-0.5 ml-8">
        {dayLabels.map((d) => (
          <span
            key={d.pct}
            className="absolute text-[10px] text-slate-400 font-semibold -translate-x-1/2"
            style={{ left: `${d.pct}%` }}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* Time axis */}
      <div className="relative h-3.5 mb-1 ml-8">
        {timeLabels.map((t) => (
          <span
            key={t.pct}
            className="absolute text-[10px] text-slate-600 -translate-x-1/2"
            style={{ left: `${t.pct}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {rows.map((row) => {
          const rowHeight = row.laneCount * LANE_HEIGHT + (row.laneCount - 1) * LANE_GAP + 4; // +4 for padding
          return (
            <div key={row.catId} className="flex items-center gap-2">
              {/* Category label */}
              <div className="w-6 text-center text-sm flex-shrink-0" title={`${row.name} (${row.count})`}>
                {row.icon}
              </div>

              {/* Bars container */}
              <div
                className="flex-1 relative bg-slate-700/30 rounded-sm overflow-hidden"
                style={{ height: `${rowHeight}px` }}
              >
                {/* Day boundary lines */}
                {dayLabels.map((d) => (
                  <div
                    key={d.pct}
                    className="absolute top-0 bottom-0 w-px bg-slate-600/30"
                    style={{ left: `${d.pct}%` }}
                  />
                ))}

                {/* Now marker */}
                <div
                  className="absolute top-0 bottom-0 w-px border-l border-dashed border-red-500/60 z-10"
                  style={{ left: `${nowPct}%` }}
                />

                {/* Alert bars — stacked in lanes */}
                {row.bars.map((bar) => (
                  <div
                    key={bar.id}
                    className="absolute rounded-sm cursor-pointer hover:brightness-125 transition-[filter]"
                    style={{
                      left: `${bar.left}%`,
                      width: `${Math.max(bar.width, 0.5)}%`,
                      top: `${2 + bar.lane * (LANE_HEIGHT + LANE_GAP)}px`,
                      height: `${LANE_HEIGHT}px`,
                      backgroundColor: bar.color,
                      opacity: 0.85,
                    }}
                    onMouseEnter={(e) => handleBarEnter(e, bar)}
                    onMouseLeave={handleBarLeave}
                    onClick={() => handleBarClick(bar)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* "Now" label */}
      <div className="relative h-4 mt-0.5 ml-8">
        <span
          className="absolute text-[9px] text-red-400 -translate-x-1/2 font-medium"
          style={{ left: `${nowPct}%`, marginLeft: '10px' }}
        >
          now
        </span>
      </div>
    </div>
  );
}
