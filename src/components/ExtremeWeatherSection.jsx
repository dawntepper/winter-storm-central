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
function AlertCard({ alert, onTap, onAddToMap, onShowDetail, onHoverAlert, onLeaveAlert, categoryColor, isEven = false }) {
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
    onAddToMap(alert);
    setShowAddPrompt(false);
  };

  const handleDismissPrompt = (e) => {
    e.stopPropagation();
    setShowAddPrompt(false);
  };

  return (
    <div className={`border-t border-slate-600/30 ${isEven ? 'bg-slate-600/40' : 'bg-slate-700/40'}`}>
      <button
        onClick={handleCardClick}
        onMouseEnter={() => onHoverAlert && onHoverAlert(alert.id)}
        onMouseLeave={() => onLeaveAlert && onLeaveAlert()}
        className="w-full text-left px-4 py-3 hover:bg-slate-500/40 transition-colors active:scale-[0.98] touch-manipulation cursor-pointer"
        style={{ minHeight: '48px' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={`flex-1 min-w-0 ${isEven ? 'text-slate-300' : 'text-gray-200'}`}>
            <h4 className="text-base font-medium truncate">
              {alert.location}
            </h4>
            <p className="text-sm mt-0.5 opacity-80">
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
          {/* Action buttons - upper right */}
          <div className="px-4 py-2 bg-slate-700/50 flex items-center justify-end gap-2">
            <button
              onClick={handleAddToMap}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors touch-manipulation cursor-pointer"
            >
              + Add to Map
            </button>
            <button
              onClick={handleDismissPrompt}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors touch-manipulation cursor-pointer"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Alert details - shown automatically when card expands */}
          {alert.headline && (
            <div className="px-4 py-3 bg-amber-900/20 border-t border-amber-500/20">
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
        </div>
      )}

    </div>
  );
}

// Category-specific header colors (solid backgrounds, antiquewhite text, colored borders)
const categoryHeaderColors = {
  'winter': { bg: '#1e3a5f', border: '#3b82f6', text: 'antiquewhite' },  // blue border
  'severe': { bg: '#4a3f1f', border: '#f97316', text: 'antiquewhite' },  // orange border
  'flooding': { bg: '#164e63', border: '#06b6d4', text: 'antiquewhite' }, // cyan border
  'default': { bg: '#334155', border: '#64748b', text: 'antiquewhite' }  // slate border
};

/**
 * Category group with collapsible alerts
 */
function CategoryGroup({ category, alerts, onAlertTap, onAddToMap, onShowDetail, onHoverAlert, onLeaveAlert, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!alerts || alerts.length === 0) return null;

  // Get category-specific colors based on category id/name
  const getCategoryColors = () => {
    const id = category.id?.toLowerCase() || category.name?.toLowerCase() || '';
    if (id.includes('winter') || id.includes('snow') || id.includes('ice')) return categoryHeaderColors.winter;
    if (id.includes('severe') || id.includes('storm') || id.includes('thunder')) return categoryHeaderColors.severe;
    if (id.includes('flood') || id.includes('coastal') || id.includes('marine')) return categoryHeaderColors.flooding;
    return categoryHeaderColors.default;
  };

  const colors = getCategoryColors();

  return (
    <div className="mb-4 rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:brightness-110 transition-all touch-manipulation cursor-pointer"
        style={{ minHeight: '48px', backgroundColor: colors.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{category.icon}</span>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
            {category.name}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.border, color: colors.text }}>
            {alerts.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Alerts List with zebra striping */}
      {isExpanded && (
        <div>
          {alerts.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onTap={onAlertTap}
              onAddToMap={onAddToMap}
              onShowDetail={onShowDetail}
              onHoverAlert={onHoverAlert}
              onLeaveAlert={onLeaveAlert}
              categoryColor={category.color}
              isEven={index % 2 === 1}
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
  onAddLocation,
  onHoverAlert,
  onLeaveAlert
}) {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const hasAlerts = categories && categories.length > 0;

  return (
    <div className="rounded-xl border border-slate-600 overflow-hidden border-l-4 border-l-orange-500" style={{ backgroundColor: '#2d3748' }}>
      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-600/50 flex items-center justify-between" style={{ backgroundColor: '#374151' }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'antiquewhite' }}>
            Extreme Weather Conditions
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
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
                onHoverAlert={onHoverAlert}
                onLeaveAlert={onLeaveAlert}
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
        <div className="px-4 py-2 border-t border-slate-600/50" style={{ backgroundColor: '#374151' }}>
          <p className="text-xs text-slate-400 text-center">
            Tap location to view alert details and show on map
          </p>
        </div>
      )}
    </div>
  );
}

export { CategoryGroup, AlertCard, EmptyState };
