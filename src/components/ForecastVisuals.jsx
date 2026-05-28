/**
 * Forecast visuals — small composable SVG/CSS pieces that enrich the
 * Current and Hourly forecast sections. Each is self-contained and
 * pure (no fetches, no internal state), so they're cheap to render
 * and easy to test.
 *
 * Exports:
 *   - TemperatureSparkline: 24h temp line chart under Current
 *   - PrecipitationStrip:   24h rain probability heatmap below Hourly
 *   - WindCompass:          rotating arrow + speed indicator
 *   - getTimeOfDayClass:    helper for day/night background tint
 */

// 16-point compass — NWS windDirection strings map to degrees.
// Convention: arrow rotates to the direction the wind is BLOWING FROM
// (meteorological standard).
const WIND_DIRECTIONS = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/**
 * Small SVG line chart of temperature over the next 24 hours.
 * Width-flexible (fills container); height fixed at 40px.
 * "Now" dot at index 0; min/max labels at the corners.
 */
export function TemperatureSparkline({ periods }) {
  if (!periods || periods.length < 2) return null;
  const next24 = periods.slice(0, 24);
  const temps = next24.map((p) => p.temperature).filter((t) => Number.isFinite(t));
  if (temps.length < 2) return null;

  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const range = maxT - minT || 1;
  const width = 240;
  const height = 44;
  const padL = 4;
  const padR = 4;
  const padT = 10;
  const padB = 12;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const x = (i) => padL + (i / (next24.length - 1)) * innerW;
  const y = (t) => padT + (1 - (t - minT) / range) * innerH;

  const pathD = next24
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.temperature).toFixed(1)}`)
    .join(' ');

  // Area under the line for a subtle fill.
  const areaD = `${pathD} L ${x(next24.length - 1)} ${height - padB} L ${x(0)} ${height - padB} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full h-11"
      role="img"
      aria-label={`Temperature trend, next 24 hours: low ${minT}°, high ${maxT}°`}
    >
      <defs>
        <linearGradient id="temp-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(56,189,248)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(56,189,248)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#temp-spark-fill)" />
      <path d={pathD} stroke="rgb(56,189,248)" strokeWidth="1.5" fill="none" />
      {/* "Now" dot */}
      <circle cx={x(0)} cy={y(next24[0].temperature)} r="3" fill="rgb(56,189,248)" />
      {/* Min / max labels (corners) */}
      <text x={padL} y={height - 2} fontSize="9" fill="rgb(148,163,184)">
        L {minT}°
      </text>
      <text x={width - padR} y={9} fontSize="9" fill="rgb(148,163,184)" textAnchor="end">
        H {maxT}°
      </text>
    </svg>
  );
}

/**
 * Horizontal heatmap of rain chance over the next 24 hours. Each segment
 * is one hour, left to right (Now → +24h). Sky-blue intensity scales with
 * how likely rain is that hour; 0% hours are dimmed gray so users can scan
 * "when is it dry" vs "when is rain expected."
 *
 * Opacity is keyed to the peak hour rather than the absolute 0-100% scale —
 * a forecast that maxes at 30% should still show clearly which hours are
 * the wettest, not be uniformly faint just because nothing crosses 50%.
 *
 * Returns null when the entire 24-hour window has 0% chance — no point
 * in showing an empty strip.
 */
export function PrecipitationStrip({ periods, timeZone }) {
  if (!periods || periods.length === 0) return null;
  const next24 = periods.slice(0, 24);
  const probs = next24.map((p) => p.probabilityOfPrecipitation?.value || 0);
  const peak = Math.max(...probs);
  if (peak === 0) return null;

  const peakIndex = probs.indexOf(peak);
  const peakPeriod = next24[peakIndex];
  const peakTimeLabel = peakPeriod
    ? new Date(peakPeriod.startTime).toLocaleTimeString(undefined, {
        hour: 'numeric',
        timeZone: timeZone || undefined,
      })
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-700">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">
          Rain chance · next 24h
        </span>
        <span className="text-[10px] text-slate-400">
          Peak <span className="text-sky-300 font-semibold">{peak}%</span>
          {peakTimeLabel && (
            <> around <span className="text-sky-300 font-semibold">{peakTimeLabel}</span></>
          )}
        </span>
      </div>
      <div className="flex gap-px h-7 rounded overflow-hidden" role="img" aria-label={`Hourly rain chance over the next 24 hours. Peak ${peak}%${peakTimeLabel ? ` around ${peakTimeLabel}` : ''}.`}>
        {probs.map((pop, i) => {
          const isDry = pop === 0;
          // Non-zero hours scale from 30% opacity (lightest blue, 1% chance)
          // up to 100% (the peak hour). 0% hours render as dim slate so they
          // visually read as "nothing here" instead of "tiny bit of rain."
          const opacity = isDry ? 0.3 : 0.3 + (pop / peak) * 0.7;
          return (
            <div
              key={i}
              className={`flex-1 ${isDry ? 'bg-slate-600' : 'bg-sky-400'}`}
              style={{ opacity }}
              title={`+${i}h: ${pop}% chance`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-slate-500">
        <span>Now</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
    </div>
  );
}

/**
 * Wind direction compass — small SVG circle with rotating arrow + speed
 * inside. Arrow points TO the direction wind is blowing FROM (meteorological
 * convention). Accepts NWS-style direction strings like "WSW" and speed
 * strings like "10 mph" / "5 to 15 mph" (takes the highest number).
 */
export function WindCompass({ direction, speed }) {
  const deg = WIND_DIRECTIONS[direction] ?? null;
  const speedMatch = (speed || '').match(/\d+/g);
  const speedDisplay = speedMatch ? speedMatch[speedMatch.length - 1] : '—';

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="text-slate-400" role="img" aria-label={`Wind from ${direction || 'unknown'} at ${speedDisplay} mph`}>
        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
        <text x="28" y="9" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.55">N</text>
        <text x="51" y="31" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.55">E</text>
        <text x="28" y="53" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.55">S</text>
        <text x="5" y="31" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.55">W</text>
        {deg != null && (
          <g transform={`rotate(${deg} 28 28)`}>
            <path d="M 28 10 L 32 28 L 28 25 L 24 28 Z" fill="rgb(56,189,248)" />
          </g>
        )}
        <text x="28" y="33" fontSize="11" textAnchor="middle" fontWeight="700" fill="rgb(241,245,249)">
          {speedDisplay}
        </text>
      </svg>
      <span className="text-[10px] text-slate-500">mph {direction || ''}</span>
    </div>
  );
}

/**
 * Returns a Tailwind-applied class name corresponding to the local time
 * at the given IANA timezone. ForecastPage applies it to its main wrapper
 * to subtly tint the page background — atmospheric without being noisy.
 *
 * Bands (local hour, 24h):
 *   5–6   → dawn   (slate → warm amber tint at top)
 *   7–17  → day    (current default dark slate, no tint)
 *   18–19 → dusk   (slate → warm rose tint at top)
 *   20–4  → night  (slate → deeper indigo tint at top)
 *
 * Tints are realized via the .forecast-tod-* classes in src/index.css.
 */
export function getTimeOfDayClass(timeZone) {
  let localHour;
  try {
    const now = new Date();
    localHour = parseInt(
      now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: timeZone || undefined }),
      10
    );
    if (!Number.isFinite(localHour)) localHour = now.getHours();
  } catch {
    localHour = new Date().getHours();
  }

  if (localHour >= 5 && localHour < 7) return 'forecast-tod-dawn';
  if (localHour >= 7 && localHour < 18) return 'forecast-tod-day';
  if (localHour >= 18 && localHour < 20) return 'forecast-tod-dusk';
  return 'forecast-tod-night';
}
