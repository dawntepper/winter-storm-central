import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createCatalogCityFromAdmin } from '../../services/locationCatalogService';
import { trackAdminCityCreated } from '../../utils/analytics';

function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function cityKey(city) {
  return `${city.query}-${city.state}`;
}

function DismissButton({ label, onDismiss, disabled }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      disabled={disabled}
      aria-label={label}
      title="Dismiss invalid entry"
      className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      ×
    </button>
  );
}

export default function RecommendedCitiesToAdd({ cities, onCityCreated, onDismiss }) {
  const [creatingKey, setCreatingKey] = useState(null);
  const [dismissingKey, setDismissingKey] = useState(null);
  const [resolved, setResolved] = useState(() => new Map());
  const [errors, setErrors] = useState(() => new Map());

  if (!cities?.length) return null;

  const handleCreate = async (city) => {
    const key = cityKey(city);
    if (creatingKey || resolved.has(key)) return;

    setCreatingKey(key);
    setErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    try {
      const result = await createCatalogCityFromAdmin({
        cityName: city.query,
        stateCode: city.state,
      });

      if (!result.ok) {
        setErrors((prev) => new Map(prev).set(key, result.error));
        return;
      }

      trackAdminCityCreated({
        cityName: result.city.name,
        stateCode: result.city.stateCode,
        source: 'recommended_missing_search',
        alreadyExists: result.alreadyExists,
      });

      setResolved((prev) =>
        new Map(prev).set(key, {
          path: result.path,
          label: `${result.city.name}, ${result.city.stateCode}`,
          alreadyExists: result.alreadyExists,
        })
      );
      onCityCreated?.(city, result);
    } catch (err) {
      setErrors((prev) =>
        new Map(prev).set(key, err.message || 'Failed to create city')
      );
    } finally {
      setCreatingKey(null);
    }
  };

  const handleDismiss = async (city) => {
    const key = cityKey(city);
    if (!onDismiss || dismissingKey) return;
    setDismissingKey(key);
    try {
      await onDismiss({ query: city.query, state: city.state });
    } finally {
      setDismissingKey(null);
    }
  };

  return (
    <div className="mb-5">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">Recommended Cities To Add</h4>
      <p className="text-xs text-slate-500 mb-3">
        Click to geocode and add a catalog city. Opens at{' '}
        <span className="text-slate-400">/alerts/city/:slug</span> when created.
      </p>
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => {
          const key = cityKey(city);
          const done = resolved.get(key);
          const isCreating = creatingKey === key;
          const isDismissing = dismissingKey === key;
          const error = errors.get(key);

          if (done) {
            return (
              <span
                key={key}
                className="inline-flex items-center gap-2 text-sm bg-emerald-950/40 border border-emerald-700/50 text-emerald-100 px-3 py-1.5 rounded-lg"
              >
                <span className="text-emerald-400" aria-hidden="true">
                  ✓
                </span>
                <span>
                  {done.alreadyExists ? 'In catalog:' : 'Created'}{' '}
                  <Link
                    to={done.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-300 hover:text-emerald-200 underline underline-offset-2 cursor-pointer"
                  >
                    {done.label}
                  </Link>
                </span>
              </span>
            );
          }

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCreate(city)}
                  disabled={Boolean(creatingKey) || isDismissing}
                  aria-label={`Add ${city.label} to catalog`}
                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    isCreating
                      ? 'bg-amber-900/20 border-amber-600/30 text-amber-200/70 cursor-wait'
                      : creatingKey || isDismissing
                        ? 'bg-amber-900/15 border-amber-700/25 text-amber-200/50 cursor-not-allowed'
                        : 'bg-amber-900/30 border-amber-700/40 text-amber-100 hover:bg-amber-800/40 hover:border-amber-600/50 cursor-pointer'
                  }`}
                >
                  {isCreating ? (
                    <>
                      <span
                        className="inline-block w-3 h-3 border-2 border-amber-400/30 border-t-amber-300 rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      Creating…
                    </>
                  ) : (
                    <>
                      {city.label}
                      <span className="text-amber-400/80 text-xs">
                        ({formatNumber(city.searchCount)} searches)
                      </span>
                    </>
                  )}
                </button>
                {onDismiss && (
                  <DismissButton
                    label={`Dismiss ${city.label}`}
                    onDismiss={() => handleDismiss(city)}
                    disabled={Boolean(creatingKey) || isDismissing}
                  />
                )}
              </div>
              {error && (
                <p className="text-xs text-red-400 max-w-xs" role="alert">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
