/**
 * Emergency Information Panel — manually curated local updates for storm events.
 * Only mounted when event.showEmergencyInfoPanel is true.
 */

import { useEffect, useMemo, useRef } from 'react';
import { CATEGORY_BADGE_COLORS } from '../data/emergencyInfoCategories';
import {
  trackEmergencyInfoPanelViewed,
  trackEmergencyInfoLinkClicked
} from '../utils/analytics';
import TwitterEmbed, { isTweetUrl } from './TwitterEmbed';

function formatTimestamp(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return null;
  }
}

function sortEntriesNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function EmergencyEntryCard({ entry, stormSlug, stormType }) {
  const badgeColor = CATEGORY_BADGE_COLORS[entry.category] || CATEGORY_BADGE_COLORS.Other;
  const updatedLabel = formatTimestamp(entry.updatedAt || entry.createdAt);

  const handleLinkClick = (linkType) => {
    trackEmergencyInfoLinkClicked({
      stormSlug,
      stormType,
      category: entry.category,
      sourceName: entry.sourceName || 'unknown',
      isOfficial: entry.isOfficial,
      linkType
    });
  };

  return (
    <article className="rounded-lg border border-slate-600/60 bg-slate-800/80 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${badgeColor}`}>
          {entry.category}
        </span>
        {entry.isOfficial && (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-medium">
            Official
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-white leading-snug break-words">
        {entry.title}
      </h3>

      {entry.location && (
        <p className="text-xs text-slate-400 break-words">{entry.location}</p>
      )}

      {entry.description && (
        <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
          {entry.description}
        </p>
      )}

      {isTweetUrl(entry.socialUrl) && (
        <TwitterEmbed tweetUrl={entry.socialUrl} />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        {entry.sourceName && entry.sourceUrl && (
          <a
            href={entry.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleLinkClick('source')}
            aria-label={`Source: ${entry.sourceName}`}
            className="inline-flex items-center min-h-11 text-sm text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
          >
            {entry.sourceName}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        )}
        {entry.socialUrl && !isTweetUrl(entry.socialUrl) && (
          <a
            href={entry.socialUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleLinkClick('social')}
            aria-label="Social update link"
            className="inline-flex items-center min-h-11 text-sm text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline"
          >
            Social update
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        )}
        {updatedLabel && (
          <time className="text-xs text-slate-500" dateTime={entry.updatedAt || entry.createdAt}>
            Updated {updatedLabel}
          </time>
        )}
      </div>
    </article>
  );
}

export default function EmergencyInfoPanel({ event }) {
  const viewedRef = useRef(false);

  const activeEntries = useMemo(() => {
    const entries = event.emergencyEntries || [];
    return sortEntriesNewestFirst(entries.filter(e => e.status === 'active'));
  }, [event.emergencyEntries]);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackEmergencyInfoPanelViewed({
      stormSlug: event.slug,
      stormType: event.type,
      entryCount: activeEntries.length
    });
  }, [event.slug, event.type, activeEntries.length]);

  const summary = event.emergencySummary;
  const summaryUpdated = formatTimestamp(summary?.updatedAt);

  return (
    <aside
      className="rounded-xl border border-amber-500/30 bg-slate-800 overflow-hidden"
      aria-labelledby="emergency-info-heading"
    >
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-900/20">
        <h2 id="emergency-info-heading" className="text-base font-semibold text-white">
          Emergency Information
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Local updates and resources curated for this event.
        </p>
      </div>

      <div className="p-4 space-y-4 max-h-none lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        {summary && (summary.title || summary.items?.length > 0) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4">
            {summary.title && (
              <h3 className="text-sm font-semibold text-amber-200 mb-2">{summary.title}</h3>
            )}
            {summary.items?.length > 0 && (
              <ul className="space-y-1.5">
                {summary.items.map((item, i) => (
                  <li key={i} className="text-sm text-amber-100/90 break-words">{item}</li>
                ))}
              </ul>
            )}
            {summaryUpdated && (
              <p className="text-[11px] text-amber-200/50 mt-2">Summary updated {summaryUpdated}</p>
            )}
          </div>
        )}

        {activeEntries.length > 0 ? (
          <div className="space-y-3" role="list">
            {activeEntries.map(entry => (
              <div key={entry.id} role="listitem">
                <EmergencyEntryCard
                  entry={entry}
                  stormSlug={event.slug}
                  stormType={event.type}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            No active emergency updates at this time.
          </p>
        )}
      </div>
    </aside>
  );
}
