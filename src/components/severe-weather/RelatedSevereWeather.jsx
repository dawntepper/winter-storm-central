import { Link } from 'react-router-dom';

export default function RelatedSevereWeather({ relatedHazards = [], onRelatedClick }) {
  if (!relatedHazards.length) return null;

  return (
    <section aria-labelledby="related-severe-heading" className="mt-10">
      <h2 id="related-severe-heading" className="text-lg font-semibold text-white mb-3">
        Related Severe Weather
      </h2>
      <ul className="space-y-2">
        {relatedHazards.map((item) => (
          <li key={item.slug}>
            <Link
              to={item.href}
              onClick={() => onRelatedClick?.(item)}
              className="block rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-3 hover:border-sky-500/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-white">
                  <span aria-hidden="true" className="mr-1.5">{item.icon}</span>
                  {item.pageTitle || item.label}
                </span>
                {typeof item.activeCount === 'number' && (
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    {item.activeCount > 0 ? `${item.activeCount} active` : 'None active'}
                  </span>
                )}
              </div>
              {item.pageTitle && item.label && item.pageTitle !== item.label ? (
                <p className="mt-1 text-xs text-slate-400">
                  Live {item.label.toLowerCase()} with radar and active alerts
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Live status, radar, and current National Weather Service alerts
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
