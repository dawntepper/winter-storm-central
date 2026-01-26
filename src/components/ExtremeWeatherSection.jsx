/**
 * Extreme Weather Section
 * Mobile-first design showing current extreme weather conditions nationwide
 * Displays when no active storm event, grouped by category
 */

import { useState } from 'react';

/**
 * Full Alert Modal - shows complete alert details
 */
function AlertModal({ alert, onClose }) {
  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl border border-slate-600 max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-amber-900/30 border-b border-amber-500/30 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-amber-200">{alert.event}</h3>
            <p className="text-sm text-slate-400">{alert.location}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {alert.headline && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Headline</h4>
              <p className="text-sm text-amber-200">{alert.headline}</p>
            </div>
          )}

          {alert.fullDescription && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Details</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{alert.fullDescription}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700">
            {alert.severity && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Severity</h4>
                <p className="text-sm text-slate-300">{alert.severity}</p>
              </div>
            )}
            {alert.urgency && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Urgency</h4>
                <p className="text-sm text-slate-300">{alert.urgency}</p>
              </div>
            )}
            {alert.onset && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Starts</h4>
                <p className="text-sm text-slate-300">{new Date(alert.onset).toLocaleString()}</p>
              </div>
            )}
            {alert.expires && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Expires</h4>
                <p className="text-sm text-slate-300">{new Date(alert.expires).toLocaleString()}</p>
              </div>
            )}
          </div>

          {alert.areaDesc && (
            <div className="pt-2 border-t border-slate-700">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Affected Areas</h4>
              <p className="text-xs text-slate-400">{alert.areaDesc}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center">
          <a
            href="https://www.weather.gov/alerts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            View all alerts on Weather.gov →
          </a>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual city/alert card with expandable warning details
 */
function AlertCard({ alert, onTap, onAddToMap, onShowDetail, categoryColor }) {
  const [showAddPrompt, setShowAddPrompt] = useState(false);

  const handleCardClick = () => {
    // First tap: show add prompt and center map
    if (!showAddPrompt) {
      onTap(alert);
      setShowAddPrompt(true);
    }
  };

  const handleAddToMap = (e) => {
    e.stopPropagation();
    console.log('AlertCard handleAddToMap - calling onAddToMap with alert:', alert);
    onAddToMap(alert);
    setShowAddPrompt(false);
  };

  const handleDismissPrompt = (e) => {
    e.stopPropagation();
    setShowAddPrompt(false);
  };

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <button
        onClick={handleCardClick}
        className="w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors active:scale-[0.98] touch-manipulation cursor-pointer"
        style={{ minHeight: '48px' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-medium text-slate-200 truncate">
              {alert.location}
            </h4>
            <p className="text-sm text-slate-400 mt-0.5">
              {alert.event}
            </p>
          </div>
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: categoryColor }}
          />
        </div>
      </button>

      {/* Add to Map prompt with alert details */}
      {showAddPrompt && (
        <div className="border-t border-slate-600/50">
          {/* Alert details - shown automatically when card expands */}
          {alert.headline && (
            <div className="px-4 py-3 bg-amber-900/20 border-b border-amber-500/20">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">📡</span>
                <div className="flex-1">
                  <p className="text-sm text-amber-200 font-medium mb-1">
                    {alert.headline}
                  </p>
                  {alert.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {alert.description}
                      {alert.description.length >= 200 && (
                        <>
                          ...{' '}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowDetail(alert);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                          >
                            Full Alert
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  {alert.expires && (
                    <p className="text-[10px] text-slate-500 mt-2">
                      Expires: {new Date(alert.expires).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add to map buttons */}
          <div className="px-4 py-3 bg-slate-700/50 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">Add to your map?</span>
            <div className="flex gap-2">
              <button
                onClick={handleAddToMap}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors touch-manipulation cursor-pointer"
              >
                Add
              </button>
              <button
                onClick={handleDismissPrompt}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs font-medium rounded-lg transition-colors touch-manipulation cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Category group with collapsible alerts
 */
function CategoryGroup({ category, alerts, onAlertTap, onAddToMap, onShowDetail, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-2 mb-2 touch-manipulation cursor-pointer hover:bg-slate-700/30 rounded-lg transition-colors"
        style={{ minHeight: '48px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{category.icon}</span>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            {category.name}
          </h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Alerts List */}
      {isExpanded && (
        <div className="space-y-2 pl-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onTap={onAlertTap}
              onAddToMap={onAddToMap}
              onShowDetail={onShowDetail}
              categoryColor={category.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Empty state when no extreme weather
 */
function EmptyState({ onAddLocation }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-4xl mb-4">&#9745;</div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        No extreme weather warnings active nationwide
      </h3>
      <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
        Enjoying calm weather? Add your locations to track conditions for family & travel.
      </p>
      <button
        onClick={onAddLocation}
        className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors touch-manipulation cursor-pointer"
        style={{ minHeight: '48px' }}
      >
        + Add Location
      </button>
    </div>
  );
}

/**
 * Loading state
 */
function LoadingState() {
  return (
    <div className="py-8 text-center">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-slate-400">Loading weather information...</p>
    </div>
  );
}

/**
 * Error state
 */
function ErrorState({ error, onRetry }) {
  return (
    <div className="py-6 px-4 text-center">
      <div className="text-2xl mb-2">📡</div>
      <p className="text-sm text-slate-400 mb-3">{error}</p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Main Extreme Weather Section Component
 */
export default function ExtremeWeatherSection({
  categories,
  loading,
  error,
  lastUpdated,
  isStale,
  onRefresh,
  onAlertTap,
  onAddToMap,
  onAddLocation
}) {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const hasAlerts = categories && categories.length > 0;

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            Extreme Weather Conditions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active warnings across the US
            {lastUpdated && !loading && (
              <span className="ml-2">
                {isStale && <span className="text-amber-400 mr-1">(cached)</span>}
                Updated {formatTime(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 touch-manipulation cursor-pointer"
          title="Refresh"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>&#8635;</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && !hasAlerts ? (
          <LoadingState />
        ) : error && !hasAlerts ? (
          <ErrorState error={error} onRetry={onRefresh} />
        ) : hasAlerts ? (
          <div>
            {categories.map((category) => (
              <CategoryGroup
                key={category.id}
                category={category}
                alerts={category.alerts}
                onAlertTap={onAlertTap}
                onAddToMap={onAddToMap}
                onShowDetail={setSelectedAlert}
                defaultExpanded={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState onAddLocation={onAddLocation} />
        )}
      </div>

      {/* Footer - total count */}
      {hasAlerts && (
        <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 text-center">
            Tap location to view alert details and show on map
          </p>
        </div>
      )}
    </div>
  );
}

export { CategoryGroup, AlertCard, EmptyState };
