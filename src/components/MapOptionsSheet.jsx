import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mobile map options bottom sheet — progressive disclosure for secondary
 * map configuration (radar, theme, view, regions). Reuses caller-provided
 * control nodes so existing handlers/analytics stay intact.
 * Portaled to document.body so sticky/transformed ancestors don't trap it.
 */
export default function MapOptionsSheet({
  open,
  onClose,
  showRadar,
  radarControl,
  appearanceControl,
  viewControl,
  regionsControl,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px] cursor-pointer"
        aria-label="Close map options"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-slate-700/80 sticky top-0 bg-slate-900 z-10">
          <div className="min-w-0">
            <h3 id={titleId} className="text-sm font-semibold text-slate-100">
              Map Options
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Radar {showRadar ? 'on' : 'off'} · adjust view & appearance
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            Done
          </button>
        </div>

        <div className="px-4 py-3 space-y-4">
          {radarControl && (
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Radar</h4>
              <div className="flex flex-wrap items-center gap-2">{radarControl}</div>
            </section>
          )}

          {appearanceControl && (
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Appearance</h4>
              <div className="flex flex-wrap items-center gap-2">{appearanceControl}</div>
            </section>
          )}

          {viewControl && (
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">View</h4>
              <div className="flex flex-wrap items-center gap-2">{viewControl}</div>
            </section>
          )}

          {regionsControl && (
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Regions</h4>
              <div className="flex flex-wrap items-center gap-2">{regionsControl}</div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
