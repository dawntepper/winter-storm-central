import { Link } from 'react-router-dom';
import { AFFILIATE_LINKS_ENABLED } from '../config/featureFlags';
import {
  ESSENTIALS_CARD_VARIANTS,
  getProductById,
  getCategoryById,
} from '../data/affiliateProducts';
import { trackEssentialsCardClick } from '../utils/analytics';

/**
 * Compact placement card for homepage / state / storm pages.
 *
 * Shows 3-4 product highlights from the chosen variant. Each item links to
 * /prep#category-anchor (NOT direct to Amazon — we want users to land on the
 * comprehensive prep guide first for trust + better conversion).
 *
 * Two layouts:
 * - 'compact' (default): vertical pill list, sidebar-friendly. Used by state
 *   and storm pages where the card sits in a constrained column.
 * - 'wide': horizontal product tiles in a 3-column grid (stacks on mobile).
 *   Used on the homepage where the card spans the full content width.
 *
 * Returns null when AFFILIATE_LINKS_ENABLED is false so callsites can stay
 * embedded in components without exposing placeholder Amazon URLs.
 *
 * @param {Object} props
 * @param {keyof typeof ESSENTIALS_CARD_VARIANTS} props.variant
 * @param {string} props.placement   Analytics placement tag (e.g. 'homepage', 'state-fl', 'storm-hurricane')
 * @param {'compact'|'wide'} [props.layout='compact']
 */
export default function EssentialsCard({ variant, placement, layout = 'compact' }) {
  if (!AFFILIATE_LINKS_ENABLED) return null;

  const config = ESSENTIALS_CARD_VARIANTS[variant];
  if (!config) return null;

  const products = config.productIds
    .map(id => getProductById(id))
    .filter(Boolean);

  if (products.length === 0) return null;

  const isWide = layout === 'wide';

  return (
    <section
      aria-labelledby={`essentials-card-${variant}-heading`}
      className={`rounded-xl border border-slate-700 bg-slate-800/60 ${isWide ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}`}
    >
      <div className={`flex items-center justify-between gap-3 ${isWide ? 'mb-4' : 'mb-3'}`}>
        <h3
          id={`essentials-card-${variant}-heading`}
          className={`${isWide ? 'text-lg' : 'text-base'} font-semibold text-white`}
        >
          {config.title}
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Sponsored</span>
      </div>

      {isWide ? (
        // Wide layout: horizontal tile grid. Each tile is a vertical block
        // with icon + name + price + "View →" affordance. Stacks to single
        // column on narrow viewports.
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {products.map(product => {
            const category = getCategoryById(product.category);
            const href = category ? `/prep#${category.anchor}` : '/prep';
            return (
              <Link
                key={product.productId}
                to={href}
                onClick={() => trackEssentialsCardClick(product.productId, placement)}
                className="flex flex-col gap-2 p-4 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 transition-colors h-full"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl flex-shrink-0" aria-hidden="true">{category?.icon || '⚡'}</span>
                  <p className="text-sm font-medium text-white">{product.productName}</p>
                </div>
                <p className="text-[11px] text-slate-400">{product.priceDescriptor} · {product.price}</p>
                <span className="mt-auto text-[11px] text-sky-400" aria-hidden="true">View →</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2 mb-3">
          {products.map(product => {
            const category = getCategoryById(product.category);
            const href = category ? `/prep#${category.anchor}` : '/prep';
            return (
              <li key={product.productId}>
                <Link
                  to={href}
                  onClick={() => trackEssentialsCardClick(product.productId, placement)}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0" aria-hidden="true">{category?.icon || '⚡'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.productName}</p>
                      <p className="text-[11px] text-slate-400 truncate">{product.priceDescriptor} · {product.price}</p>
                    </div>
                  </div>
                  <span className="text-sky-400 text-sm flex-shrink-0" aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to="/prep"
        onClick={() => trackEssentialsCardClick('view-full-guide', placement)}
        className="block text-center text-sm text-sky-400 hover:text-sky-300 font-medium"
      >
        View full prep guide →
      </Link>
      <p className="mt-3 pt-3 border-t border-slate-700 text-[10px] text-slate-500 leading-relaxed">
        As an Amazon Associate, StormTracking earns from qualifying purchases. We only list things we'd buy ourselves.
      </p>
    </section>
  );
}
