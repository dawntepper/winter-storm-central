/**
 * Radar-page overlay layers: wind field (Open-Meteo GFS).
 *
 * Lightning: deferred — no free CORS-friendly real-time strike feed without a
 * backend proxy (Blitzortung/GOES GLM require licensing or server-side fetch).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchConusWindGrid } from '../../services/windGridService';

const WIND_PANE = 'wind-overlay';

function ensurePane(map, name, zIndex) {
  let pane = map.getPane(name);
  if (!pane) {
    pane = map.createPane(name);
  }
  pane.style.zIndex = String(zIndex);
  return pane;
}

function speedToColor(speedMs) {
  if (speedMs < 3) return 'rgba(148, 163, 184, 0.75)';
  if (speedMs < 7) return 'rgba(56, 189, 248, 0.85)';
  if (speedMs < 12) return 'rgba(34, 197, 94, 0.9)';
  if (speedMs < 18) return 'rgba(234, 179, 8, 0.9)';
  return 'rgba(239, 68, 68, 0.95)';
}

function drawWindArrow(ctx, x, y, speedMs, directionDeg, length) {
  // Meteorological direction = where wind comes FROM; arrow points downwind.
  const rad = ((directionDeg + 180) % 360) * (Math.PI / 180);
  const dx = Math.sin(rad) * length;
  const dy = -Math.cos(rad) * length;

  ctx.strokeStyle = speedToColor(speedMs);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  const head = Math.max(4, length * 0.35);
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(
    x + dx - head * Math.cos(angle - Math.PI / 6),
    y + dy - head * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x + dx - head * Math.cos(angle + Math.PI / 6),
    y + dy - head * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

export function WindOverlayLayer({ show, onLoadingChange }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const gridRef = useRef(null);
  const rafRef = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid?.points?.length) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size.x, size.y);

    const zoom = map.getZoom();
    const arrowLen = Math.min(28, 10 + zoom * 1.4);
    const bounds = map.getBounds();

    for (const point of grid.points) {
      if (!bounds.contains([point.lat, point.lon])) continue;
      if (point.speed < 0.3) continue;
      const pixel = map.latLngToContainerPoint([point.lat, point.lon]);
      drawWindArrow(ctx, pixel.x, pixel.y, point.speed, point.direction, arrowLen);
    }
  }, [map]);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(redraw);
  }, [redraw]);

  useEffect(() => {
    const pane = ensurePane(map, WIND_PANE, 405);
    const canvas = L.DomUtil.create('canvas', 'wind-overlay-canvas');
    canvas.style.pointerEvents = 'none';
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    map.on('move', scheduleRedraw);
    map.on('zoom', scheduleRedraw);
    map.on('resize', scheduleRedraw);

    return () => {
      map.off('move', scheduleRedraw);
      map.off('zoom', scheduleRedraw);
      map.off('resize', scheduleRedraw);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, scheduleRedraw]);

  useEffect(() => {
    if (!show) {
      onLoadingChange?.(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let cancelled = false;
    onLoadingChange?.(true);

    fetchConusWindGrid().then((grid) => {
      if (cancelled) return;
      gridRef.current = grid;
      onLoadingChange?.(false);
      scheduleRedraw();
    });

    const refresh = setInterval(() => {
      fetchConusWindGrid().then((grid) => {
        if (cancelled || !grid) return;
        gridRef.current = grid;
        scheduleRedraw();
      });
    }, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
      onLoadingChange?.(false);
    };
  }, [show, onLoadingChange, scheduleRedraw]);

  return null;
}

/** IEM HRRR simulated reflectivity — ~1 hour forecast (CONUS). */
export const HRRR_FORECAST_WMS_URL = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/hrrr/refp.cgi';
export const HRRR_FORECAST_LAYER = 'refp_0060';
