/**
 * Storm Event Page Component
 * Individual page for tracking specific weather events (e.g., Winter Storm Fern, Nor'easter)
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useExtremeWeather } from '../hooks/useExtremeWeather';
import StormMap from './StormMap';
import { getStormEventBySlug } from '../services/stormEventsService';
import { ALERT_CATEGORIES, CATEGORY_ORDER } from '../services/noaaAlertsService';
import { STATE_CENTROIDS } from '../data/stateCentroids';
import { STATE_NAMES, US_STATES } from '../data/stateConfig';
import {
  trackStormPageView,
  trackStormAlertExpanded,
  trackStormShare,
  trackStormMapInteraction,
  trackStormAlertDetailView,
  trackStormPageEntry,
  trackStormRadarClick,
  trackRadarLinkClick,
  trackBrowseByStateClick
} from '../utils/analytics';

// Category header colors
const categoryHeaderColors = {
  'winter': { bg: '#1e3a5f', border: '#3b82f6', text: 'antiquewhite' },
  'severe': { bg: '#4a3f1f', border: '#f97316', text: 'antiquewhite' },
  'flood': { bg: '#164e63', border: '#06b6d4', text: 'antiquewhite' },
  'heat': { bg: '#7c2d12', border: '#ef4444', text: 'antiquewhite' },
  'fire': { bg: '#78350f', border: '#d97706', text: 'antiquewhite' },
  'tropical': { bg: '#1e3a8a', border: '#6366f1', text: 'antiquewhite' },
  'default': { bg: '#334155', border: '#64748b', text: 'antiquewhite' }
};

// Status badge colors
const statusColors = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  forecasted: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/40'
};

const statusLabels = {
  active: 'Active Now',
  forecasted: 'Forecasted',
  completed: 'Completed'
};

// Event type icons
const typeIcons = {
  winter_storm: '❄️',
  hurricane: '🌀',
  severe_weather: '⛈️',
  flooding: '🌊',
  heat_wave: '🌡️',
  wildfire: '🔥',
  default: '⚠️'
};

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// SEO helper - update meta tags dynamically
function updateMetaTags(event) {
  if (!event) return;

  // Update title
  document.title = event.seoTitle || `${event.title} Live Radar | Real-Time Alerts & Tracking`;

  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', event.seoDescription || `Track ${event.title} with live weather radar. Real-time alerts, interactive radar maps, and forecasts for affected areas.`);
  }

  // Update OG tags
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${event.title} Live Radar & Alerts`);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', `Track ${event.title} with live weather radar. Real-time alerts and interactive radar maps.`);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', `https://stormtracking.io/storm/${event.slug}`);

  // Update Twitter tags
  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', `${event.title} Live Radar & Alerts`);

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', `Track ${event.title} with live weather radar and real-time alerts.`);

  // Update keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords && event.keywords) {
    metaKeywords.setAttribute('content', event.keywords.join(', ') + ', live radar, real-time alerts, weather radar, storm tracking');
  }

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `https://stormtracking.io/storm/${event.slug}`);

  // Update OG image to dynamic storm-specific image
  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', `https://stormtracking.io/api/og-image/storm/${event.slug}`);

  let twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', `https://stormtracking.io/api/og-image/storm/${event.slug}`);
}

// Reset meta tags to defaults
function resetMetaTags() {
  const defaultTitle = 'StormTracking - Live Weather Radar & Real-Time Storm Alerts';
  const defaultDesc = 'Live weather radar with real-time severe weather alerts. Track winter storms, hurricanes, and severe weather with interactive radar maps. Free NOAA/NWS data.';

  document.title = defaultTitle;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', defaultDesc);

  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', defaultTitle);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', defaultDesc);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', 'https://stormtracking.io');

  let twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', defaultTitle);

  let twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', defaultDesc);

  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', 'https://stormtracking.io');

  // Reset OG image to default
  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', 'https://stormtracking.io/og-image.png');

  let twImage = document.querySelector('meta[property="twitter:image"]');
  if (twImage) twImage.setAttribute('content', 'https://stormtracking.io/og-image.png');
}

// Alert card component for event page
function EventAlertCard({ alert, onClick }) {
  return (
    <div
      className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
      onClick={() => onClick && onClick(alert)}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">
          {alert.category === 'winter' ? '❄️' :
           alert.category === 'flood' ? '🌊' :
           alert.category === 'severe' ? '⛈️' : '⚠️'}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white">{alert.event}</h4>
          <p className="text-xs text-slate-400">{alert.location}</p>
          {alert.headline && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{alert.headline}</p>
          )}
        </div>
        {alert.severity && (
          <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
            {alert.severity}
          </span>
        )}
      </div>
    </div>
  );
}

// Alert detail modal
function AlertDetailModal({ alert, onClose }) {
  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
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
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            View on Weather.gov →
          </a>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Threshold for grouping by state
const STATE_GROUP_THRESHOLD = 5;

// Individual alert item with expandable details (similar to main page AlertCard)
function EventAlertItem({ alert, onZoomToAlert, onShowDetail, isEven = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    // First tap: zoom to location and expand details
    if (!isExpanded) {
      onZoomToAlert(alert);
      setIsExpanded(true);
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setIsExpanded(false);
  };

  return (
    <div className={`border-t border-slate-600/30 ${isEven ? 'bg-slate-600/40' : 'bg-slate-700/40'}`}>
      {/* Main row - city info on left, buttons on right when expanded */}
      <div className="flex items-center px-3 py-2 hover:bg-slate-500/40 transition-colors">
        <button
          onClick={handleClick}
          className="flex-1 text-left cursor-pointer min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white truncate">{alert.location}</h4>
              <p className="text-xs text-slate-400">{alert.event}</p>
            </div>
            {!isExpanded && alert.severity && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30 flex-shrink-0">
                {alert.severity}
              </span>
            )}
          </div>
        </button>

        {/* Inline action buttons when expanded */}
        {isExpanded && (
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowDetail(alert);
              }}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              View Alert
            </button>
            <button
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-white bg-slate-600 hover:bg-slate-500 rounded transition-colors cursor-pointer"
              title="Close"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Alert headline preview - shown below when expanded */}
      {isExpanded && alert.headline && (
        <div className="px-3 py-2 bg-amber-900/20 border-t border-amber-500/20">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5 text-sm">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-amber-200 font-medium">{alert.headline}</p>
              {alert.expires && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Expires: {new Date(alert.expires).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Group alerts by state code
function groupAlertsByState(alerts) {
  const byState = {};
  for (const alert of alerts) {
    const state = alert.state || 'Unknown';
    if (!byState[state]) {
      byState[state] = [];
    }
    byState[state].push(alert);
  }
  return Object.entries(byState)
    .map(([code, stateAlerts]) => ({
      code,
      name: STATE_NAMES[code] || code,
      alerts: stateAlerts
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// State group within a category (collapsible)
function StateAlertGroup({ state, alerts, onZoomToAlert, onShowDetail, onStateZoom, categoryColor, isSelected = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when selected
  useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  const handleStateZoom = (e) => {
    e.stopPropagation();
    if (onStateZoom) {
      onStateZoom(state.code);
    }
  };

  return (
    <div
      className="border-t border-slate-600/30"
      style={isSelected ? {
        borderLeft: '4px solid #10b981',
        backgroundColor: 'rgba(6, 78, 59, 0.4)'
      } : {}}
    >
      <div
        className={`flex items-center transition-colors ${isSelected ? '' : 'bg-slate-700/50 hover:bg-slate-600/50'}`}
        style={isSelected ? { backgroundColor: 'rgba(6, 78, 59, 0.5)' } : {}}
      >
        <button
          onClick={(e) => {
            setIsExpanded(!isExpanded);
            // Also zoom to state when clicking the title
            if (onStateZoom) {
              onStateZoom(state.code);
            }
          }}
          className="flex-1 flex items-center justify-between px-3 py-2 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>{state.name}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
              {alerts.length}
            </span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400' : 'text-slate-400'} ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {/* Zoom to state button */}
        <button
          onClick={handleStateZoom}
          className={`p-2 transition-colors cursor-pointer ${isSelected ? 'text-emerald-400' : 'text-slate-400 hover:text-sky-400'}`}
          title={`Zoom to ${state.name}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
      </div>
      {isExpanded && (
        <div>
          {alerts.map((alert, index) => (
            <EventAlertItem
              key={alert.id}
              alert={alert}
              onZoomToAlert={onZoomToAlert}
              onShowDetail={onShowDetail}
              isEven={index % 2 === 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Alert category group with collapsible list (groups by state if many alerts)
function AlertCategoryGroup({ category, alerts, onZoomToAlert, onShowDetail, onStateZoom, selectedStateCode, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!alerts || alerts.length === 0) return null;

  const colors = categoryHeaderColors[category.id] || categoryHeaderColors.default;
  const shouldGroupByState = alerts.length > STATE_GROUP_THRESHOLD;
  const stateGroups = shouldGroupByState ? groupAlertsByState(alerts) : null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:brightness-110 transition-all cursor-pointer"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{category.icon}</span>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.text }}>
            {category.name}
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.border, color: colors.text }}>
            {alerts.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content - either state groups or flat alert list */}
      {isExpanded && (
        <div className="max-h-[300px] overflow-y-auto">
          {shouldGroupByState ? (
            stateGroups.map((state) => (
              <StateAlertGroup
                key={state.code}
                state={state}
                alerts={state.alerts}
                onZoomToAlert={onZoomToAlert}
                onShowDetail={onShowDetail}
                onStateZoom={onStateZoom}
                categoryColor={colors.border}
                isSelected={selectedStateCode === state.code}
              />
            ))
          ) : (
            alerts.map((alert, index) => (
              <EventAlertItem
                key={alert.id}
                alert={alert}
                onZoomToAlert={onZoomToAlert}
                onShowDetail={onShowDetail}
                isEven={index % 2 === 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Mobile-only collapsed alerts card (shown above map on mobile)
function MobileAlertsCard({ filteredAlerts, alertsLoading, refreshAlerts, handleZoomToAlert, handleShowDetail, handleStateZoom, selectedStateCode }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500">⚠️</span>
          <h2 className="text-base font-semibold text-white">
            Active Alerts ({filteredAlerts.length})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshAlerts();
            }}
            disabled={alertsLoading}
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <span className={alertsLoading ? 'animate-spin inline-block' : ''}>&#8635;</span>
          </button>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-slate-700">
          {alertsLoading && filteredAlerts.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-6 h-6 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading alerts...</p>
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              {CATEGORY_ORDER.map(categoryId => {
                const category = ALERT_CATEGORIES[categoryId];
                const categoryAlerts = filteredAlerts.filter(a => a.category === categoryId);
                if (categoryAlerts.length === 0) return null;
                return (
                  <AlertCategoryGroup
                    key={categoryId}
                    category={category}
                    alerts={categoryAlerts}
                    onZoomToAlert={handleZoomToAlert}
                    onShowDetail={handleShowDetail}
                    onStateZoom={handleStateZoom}
                    selectedStateCode={selectedStateCode}
                    defaultExpanded={false}
                  />
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-slate-500 text-sm">No active alerts for this event</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Share button component
function ShareButton({ event }) {
  const [shareMessage, setShareMessage] = useState('');

  const handleShare = async () => {
    const shareUrl = `https://stormtracking.io/storm/${event.slug}`;
    const shareData = {
      title: `${event.title} Live Tracker`,
      text: `Track ${event.title} in real-time with live alerts and radar on StormTracking.io`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Link copied!');
        setTimeout(() => setShareMessage(''), 2000);
      }
    }

    // Track share
    trackStormShare({
      stormSlug: event.slug,
      stormName: event.title
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 border border-slate-600 cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>
      {shareMessage && (
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-emerald-400 whitespace-nowrap bg-slate-800 px-2 py-1 rounded">
          {shareMessage}
        </span>
      )}
    </div>
  );
}

// NWS Forecast Maps Section
function ForecastMapsSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMap, setSelectedMap] = useState('snowfall');
  const [selectedDay, setSelectedDay] = useState('day1');

  // Generate date labels: "Today (Jan 28)", "Wed Jan 29", "Thu Jan 30"
  const getDayLabel = (dayOffset) => {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const formatted = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (dayOffset === 0) return `Today (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    return formatted;
  };

  const day1Label = getDayLabel(0);
  const day2Label = getDayLabel(1);
  const day3Label = getDayLabel(2);

  // NWS WPC Forecast Map URLs - one map per day per category
  const forecastMaps = {
    snowfall: {
      label: 'Snow',
      icon: '❄️',
      maps: {
        'day1': {
          label: day1Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day1_psnow_gt_04_conus.gif',
          description: 'Snow forecast'
        },
        'day2': {
          label: day2Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day2_psnow_gt_04_conus.gif',
          description: 'Snow forecast'
        },
        'day3': {
          label: day3Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day3_psnow_gt_04_conus.gif',
          description: 'Snow forecast'
        }
      }
    },
    ice: {
      label: 'Ice',
      icon: '🧊',
      maps: {
        'day1': {
          label: day1Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day1_pice_gt_25_conus.gif',
          description: 'Ice forecast'
        },
        'day2': {
          label: day2Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day2_pice_gt_25_conus.gif',
          description: 'Ice forecast'
        },
        'day3': {
          label: day3Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day3_pice_gt_25_conus.gif',
          description: 'Ice forecast'
        }
      }
    },
    composite: {
      label: 'Composite',
      icon: '🗺️',
      maps: {
        'day1': {
          label: day1Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day1_composite_conus.gif',
          description: 'Winter weather hazards outlook'
        },
        'day2': {
          label: day2Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day2_composite_conus.gif',
          description: 'Winter weather hazards outlook'
        },
        'day3': {
          label: day3Label,
          url: 'https://www.wpc.ncep.noaa.gov/wwd/day3_composite_conus.gif',
          description: 'Winter weather hazards outlook'
        }
      }
    }
  };

  const currentMapType = forecastMaps[selectedMap];
  const mapOptions = Object.keys(currentMapType.maps);
  const currentMap = currentMapType.maps[selectedDay] || currentMapType.maps[mapOptions[0]];

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-800 hover:bg-slate-700/50 transition-colors cursor-pointer"
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🔮</span> NWS Forecast Maps
        </h2>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (<>
      {/* Map Type Selector */}
      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(forecastMaps).map(([key, map]) => (
            <button
              key={key}
              onClick={() => setSelectedMap(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                selectedMap === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {map.icon} {map.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day Selector - Dropdown */}
      <div className="px-4 py-2 border-b border-slate-700 bg-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">View:</span>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="bg-slate-600 text-white text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-500 focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {Object.entries(currentMapType.maps).map(([key, map]) => (
              <option key={key} value={key}>
                {map.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Map Display */}
      <div className="p-4">
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <img
            src={currentMap.url}
            alt={`${currentMapType.label} - ${currentMap.label}`}
            className="w-full h-auto"
            style={{ maxHeight: '500px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.insertAdjacentHTML('afterend', '<p class="text-slate-400 text-sm text-center py-8">Map temporarily unavailable</p>');
            }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          {currentMap.description} • Source: NOAA Weather Prediction Center
        </p>
      </div>

      {/* Footer with links */}
      <div className="px-4 py-2 border-t border-slate-700 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Updates every 6 hours</span>
          <a
            href="https://www.wpc.ncep.noaa.gov/wwd/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300"
          >
            View more at WPC →
          </a>
        </div>
      </div>
      </>)}
    </div>
  );
}

// 404 Not Found component
function EventNotFound({ slug }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🌪️</div>
        <h1 className="text-2xl font-bold text-white mb-2">Event Not Found</h1>
        <p className="text-slate-400 mb-6">
          We couldn't find a storm event matching "{slug}". It may have been removed or the URL is incorrect.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function StormEventPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);  // For the detail modal
  const [selectedAlertId, setSelectedAlertId] = useState(null);  // For green marker on map
  const [selectedStateCode, setSelectedStateCode] = useState(null);  // For highlighted state border
  const [mapCenterOn, setMapCenterOn] = useState(null);
  const mobileMapRef = useRef(null);  // Ref for scrolling to map on mobile

  // Get alerts data
  const {
    alerts: alertsData,
    loading: alertsLoading,
    refresh: refreshAlerts,
    getAlertsByCategory
  } = useExtremeWeather(true);

  // Fetch the event by slug from Supabase
  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      const { data, error } = await getStormEventBySlug(slug);

      if (error) {
        console.error('Error fetching storm event:', error);
      }

      setEvent(data || null);
      setLoading(false);

      if (data) {
        updateMetaTags(data);

        // Track storm page view with full details
        trackStormPageView({
          stormName: data.title,
          stormSlug: data.slug,
          stormType: data.type,
          stormStatus: data.status,
          affectedStates: data.affectedStates?.join(',') || ''
        });

        trackStormPageEntry({
          stormSlug: data.slug,
          referrer: document.referrer ? new URL(document.referrer).hostname : '',
          isDirect: !document.referrer
        });
      }
    }

    fetchEvent();

    // Cleanup: reset meta tags when leaving
    return () => resetMetaTags();
  }, [slug]);

  // Filter alerts for this event's affected states and categories
  const filteredAlerts = alertsData?.allAlerts?.filter(alert => {
    // Check if alert is in an affected state
    // Use the state field first (most reliable), fallback to location string
    const stateMatch = event?.affectedStates?.length > 0
      ? event.affectedStates.some(state =>
          alert.state === state ||
          alert.location?.endsWith(`, ${state}`) ||
          alert.areaDesc?.includes(state)
        )
      : true; // If no states specified, show all

    // Check if alert category matches event categories
    const categoryMatch = !event?.alertCategories?.length ||
      event.alertCategories.includes(alert.category);

    return stateMatch && categoryMatch;
  }) || [];

  // Show all alerts for selected states on map
  const mapAlerts = filteredAlerts;

  // Handle zoom to alert - center map on alert location (first click) and scroll to map
  const handleZoomToAlert = (alert) => {
    if (alert.lat && alert.lon) {
      setMapCenterOn({ lat: alert.lat, lon: alert.lon, id: Date.now() });
      setSelectedAlertId(alert.id);  // Mark this alert as selected (green marker)

      // Scroll to map on mobile
      if (mobileMapRef.current) {
        mobileMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Track city click on map
      if (event) {
        trackStormMapInteraction({
          stormSlug: event.slug,
          interactionType: 'city_click'
        });
      }
    }
  };

  // Handle showing alert detail modal (separate action)
  const handleShowDetail = (alert) => {
    setSelectedAlert(alert);
    if (event) {
      trackStormAlertDetailView({
        stormSlug: event.slug,
        alertType: alert.event,
        alertSeverity: alert.severity,
        alertLocation: alert.location
      });
    }
  };

  // Handle state zoom - center map on state centroid
  const handleStateZoom = (stateCode) => {
    const coords = STATE_CENTROIDS[stateCode];
    if (coords) {
      setMapCenterOn({ lat: coords.lat, lon: coords.lon, zoom: 7, id: Date.now() });
      setSelectedStateCode(stateCode);  // Mark this state as selected (border highlight)
      setSelectedAlertId(null);  // Clear any selected alert

      // Track state alert expansion
      const stateAlertCount = filteredAlerts.filter(a => a.state === stateCode).length;
      if (event) {
        trackStormAlertExpanded({
          stormSlug: event.slug,
          stateExpanded: stateCode,
          alertCount: stateAlertCount
        });
        trackStormMapInteraction({
          stormSlug: event.slug,
          interactionType: 'state_click'
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return <EventNotFound slug={slug} />;
  }

  const icon = typeIcons[event.type] || typeIcons.default;
  const statusColor = statusColors[event.status] || statusColors.forecasted;
  const statusLabel = statusLabels[event.status] || event.status;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Back Link */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline text-sm">Back</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">📡</span>
              <Link to="/" className="text-lg sm:text-xl font-bold text-white">StormTracking</Link>
            </div>
          </div>

          {/* Nav Links & Share */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/radar" onClick={() => trackRadarLinkClick('storm_header')} className="text-[10px] sm:text-xs text-emerald-400 hover:bg-emerald-500/25 font-medium bg-emerald-500/15 pl-2 pr-2 py-0.5 rounded border border-emerald-500/30 transition-colors">Live Radar</Link>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  const abbr = US_STATES[e.target.value]?.abbr;
                  if (abbr) trackBrowseByStateClick({ stateCode: abbr, source: 'storm_header' });
                  navigate(`/alerts/${e.target.value}`);
                  e.target.value = '';
                }
              }}
              className="appearance-none bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 cursor-pointer pl-2 pr-1 py-0.5 rounded focus:outline-none text-[10px] sm:text-xs font-medium border border-sky-500/30 transition-colors"
            >
              <option value="" disabled>State Weather Tracker ▾</option>
              {Object.entries(US_STATES).map(([slug, s]) => (
                <option key={slug} value={slug}>{s.name}</option>
              ))}
            </select>
            <ShareButton event={event} />
          </div>
        </div>
      </header>

      {/* Event Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Icon, Title, Status - stays outside the card */}
          <div className="flex flex-wrap items-start gap-4 mb-6">
            <span className="text-4xl">{icon}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{event.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-xs px-3 py-1 rounded-full border ${statusColor}`}>
                  {statusLabel}
                </span>
                <span className="text-sm text-slate-400">
                  {formatDate(event.startDate)} - {formatDate(event.endDate)}
                </span>
                <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700 rounded">
                  {event.typeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Storm Overview Card - Description + Affected Areas */}
          <div className="rounded-lg border border-blue-500/50 p-6" style={{ backgroundColor: '#1e3a5f' }}>
            {/* Description */}
            <p className="text-slate-100 leading-relaxed mb-4">
              {event.description}
            </p>

            {/* Divider + Affected States */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 text-sm font-medium mr-4">Affected Areas:</span>
                {[...event.affectedStates].sort((a, b) => (STATE_NAMES[a] || a).localeCompare(STATE_NAMES[b] || b)).map(state => {
                  const coords = STATE_CENTROIDS[state];
                  const stateName = STATE_NAMES[state] || state;
                  const alertCount = filteredAlerts.filter(a => a.state === state).length;

                  const isStateSelected = selectedStateCode === state;
                  return (
                    <button
                      key={state}
                      onClick={() => {
                        if (coords) {
                          setMapCenterOn({ lat: coords.lat, lon: coords.lon, zoom: 7, id: Date.now() });
                          setSelectedStateCode(state);  // Highlight state in alert cards
                          setSelectedAlertId(null);  // Clear any selected alert
                          // Scroll to map on mobile
                          if (mobileMapRef.current) {
                            mobileMapRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }
                      }}
                      title={`${stateName} - ${alertCount} active alert${alertCount !== 1 ? 's' : ''} (click to zoom)`}
                      className={`text-xs px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1 ${
                        isStateSelected
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                          : 'bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white'
                      }`}
                    >
                      {state}
                      {alertCount > 0 && (
                        <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1 rounded">
                          {alertCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Storm Radar Section */}
      {event.status !== 'completed' && (
        <div className="bg-slate-800/50 border-b border-slate-700 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">{event.title} Live Radar</h2>
              <p className="text-sm text-slate-400">
                View {event.title} on our interactive weather radar map showing real-time
                conditions and severe weather alerts for {event.affectedStates?.slice(0, 5).join(', ')}{event.affectedStates?.length > 5 ? '...' : ''}.
              </p>
            </div>
            <Link
              to="/radar"
              onClick={() => trackStormRadarClick({ stormSlug: event.slug, source: 'storm_page_cta' })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
            >
              <span>📡</span> View Full Radar Map
            </Link>
          </div>
        </div>
      )}

      {/* Forecast Maps Section - Hidden for now, revisiting design */}
      {/* {event.status !== 'completed' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <ForecastMapsSection />
        </div>
      )} */}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {event.status === 'completed' ? (
          /* COMPLETED EVENT - Historical Summary */
          <div className="max-w-3xl mx-auto">
            {/* Historical Notice */}
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📜</span>
                <div>
                  <h3 className="font-semibold text-white">Historical Event</h3>
                  <p className="text-sm text-slate-400">
                    This storm event concluded on {formatDate(event.endDate)}. Below is a summary of the event.
                  </p>
                </div>
              </div>
            </div>

            {/* Event Summary */}
            {event.impacts && event.impacts.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-slate-700">
                  <h2 className="text-base font-semibold text-white">Event Summary</h2>
                </div>
                <div className="p-4">
                  <ul className="space-y-2">
                    {event.impacts.map((impact, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-sky-400 mt-0.5">•</span>
                        {impact}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Historical Statistics */}
            {(event.peakAlertCount || event.totalAlertsIssued) && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-slate-700">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>📊</span> Event Statistics
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {event.peakAlertCount && (
                      <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-white">{event.peakAlertCount}</div>
                        <div className="text-xs text-slate-400">Peak Alerts</div>
                      </div>
                    )}
                    {event.totalAlertsIssued && (
                      <div className="text-center p-3 bg-slate-700/50 rounded-lg">
                        <div className="text-2xl font-bold text-white">{event.totalAlertsIssued}</div>
                        <div className="text-xs text-slate-400">Total Alerts Issued</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Static Map showing affected area */}
            <div className="mb-6">
              <StormMap
                weatherData={{}}
                stormPhase="post-storm"
                userLocations={[]}
                alerts={[]}
                isHero
                centerOn={event.mapCenter ? { ...event.mapCenter, zoom: event.mapZoom || 5, id: Date.now() } : null}
              />
            </div>

            {/* Back to Main Tracker */}
            <Link
              to="/"
              className="block text-center py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            >
              View Current Weather Alerts →
            </Link>
          </div>
        ) : (
          /* ACTIVE/FORECASTED EVENT - Live Tracker */
          <>
            {/* ===== MOBILE LAYOUT ===== */}
            <div className="lg:hidden space-y-4">
              {/* Mobile: Collapsed Alerts Card (above map) */}
              <MobileAlertsCard
                filteredAlerts={filteredAlerts}
                alertsLoading={alertsLoading}
                refreshAlerts={refreshAlerts}
                handleZoomToAlert={handleZoomToAlert}
                handleShowDetail={handleShowDetail}
                handleStateZoom={handleStateZoom}
                selectedStateCode={selectedStateCode}
              />

              {/* Mobile: Map */}
              <div ref={mobileMapRef}>
                <StormMap
                  weatherData={{}}
                  stormPhase="active"
                  userLocations={[]}
                  alerts={mapAlerts}
                  isHero
                  centerOn={mapCenterOn || (event.mapCenter ? { ...event.mapCenter, zoom: event.mapZoom || 5, id: 'initial' } : null)}
                  selectedAlertId={selectedAlertId}
                />
              </div>
            </div>

            {/* ===== DESKTOP LAYOUT ===== */}
            <div className="hidden lg:grid lg:grid-cols-[3fr_2fr] gap-6 items-start">
              {/* Left Column: Map (~60% on desktop) */}
              <div>
                <StormMap
                  weatherData={{}}
                  stormPhase="active"
                  userLocations={[]}
                  alerts={mapAlerts}
                  isHero
                  centerOn={mapCenterOn || (event.mapCenter ? { ...event.mapCenter, zoom: event.mapZoom || 5, id: 'initial' } : null)}
                  selectedAlertId={selectedAlertId}
                />
              </div>

              {/* Right Column: Alerts & Details (~40% on desktop) */}
              <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                {/* Active Alerts Header */}
                <div className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3 border border-slate-700">
                  <h2 className="text-base font-semibold text-white">
                    Active Alerts ({filteredAlerts.length})
                  </h2>
                  <button
                    onClick={refreshAlerts}
                    disabled={alertsLoading}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className={alertsLoading ? 'animate-spin inline-block' : ''}>&#8635;</span>
                  </button>
                </div>

                {alertsLoading && filteredAlerts.length === 0 ? (
                  <div className="p-6 text-center bg-slate-800 rounded-xl border border-slate-700">
                    <div className="w-6 h-6 border-2 border-slate-600 border-t-sky-400 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Loading alerts...</p>
                  </div>
                ) : filteredAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {/* Group alerts by category */}
                    {CATEGORY_ORDER.map(categoryId => {
                      const category = ALERT_CATEGORIES[categoryId];
                      const categoryAlerts = filteredAlerts.filter(a => a.category === categoryId);
                      if (categoryAlerts.length === 0) return null;
                      return (
                        <AlertCategoryGroup
                          key={categoryId}
                          category={category}
                          alerts={categoryAlerts}
                          onZoomToAlert={handleZoomToAlert}
                          onShowDetail={handleShowDetail}
                          onStateZoom={handleStateZoom}
                          selectedStateCode={selectedStateCode}
                          defaultExpanded={true}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-800 rounded-xl border border-slate-700">
                  <p className="text-slate-500 text-sm">
                    {event.status === 'forecasted'
                      ? 'Alerts will appear as the event approaches'
                      : 'No active alerts for this event'}
                  </p>
                </div>
              )}

              {/* Expected Impacts */}
              {event.impacts && event.impacts.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <h2 className="text-base font-semibold text-white">
                      {event.status === 'forecasted' ? 'Expected Impacts' : 'Reported Impacts'}
                    </h2>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-2">
                      {event.impacts.map((impact, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-amber-500 mt-0.5">•</span>
                          {impact}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Back to Main Tracker */}
              <Link
                to="/"
                className="block text-center py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              >
                View All Weather Alerts →
              </Link>
            </div>
          </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-slate-800 px-4">
        <p className="text-slate-500 text-xs max-w-2xl mx-auto">
          <span className="font-medium text-slate-400">Disclaimer:</span> StormTracking uses NOAA/National Weather Service data for informational purposes only. Weather forecasts can change rapidly. Always verify with official sources at{' '}
          <a href="https://weather.gov" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">weather.gov</a>
          {' '}and follow local emergency management guidance.
        </p>
      </footer>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
            "name": event.title,
            "description": event.description,
            "startDate": event.startDate,
            "endDate": event.endDate,
            "eventStatus": event.status === 'completed'
              ? "https://schema.org/EventEnded"
              : "https://schema.org/EventScheduled",
            "location": {
              "@type": "Place",
              "name": "United States",
              "address": {
                "@type": "PostalAddress",
                "addressRegion": event.affectedStates.join(', ')
              }
            },
            "url": `https://stormtracking.io/storm/${event.slug}`,
            "image": `https://stormtracking.io/api/og-image/storm/${event.slug}`
          })
        }}
      />

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
