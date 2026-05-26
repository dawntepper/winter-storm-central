import { Link } from 'react-router-dom';
import { AFFILIATE_LINKS_ENABLED } from '../config/featureFlags';
import {
  ESSENTIALS_CARD_VARIANTS,
  getProductById,
  getCategoryById,
} from '../data/affiliateProducts';
import { trackEssentialsCardClick } from '../utils/analytics';

/**
 * Curated affiliate placement card. Renders on homepage, qualifying state
 * pages, qualifying storm pages, and /radar.
 *
 * Products link to /prep#category-anchor (NOT direct to Amazon) so users
 * land on the comprehensive prep guide first — better trust + conversion.
 *
 * Layout: wide horizontal tile grid that adapts to product count.
 *   - 3 products → 3 columns on lg+, 2 on md, 1 on mobile.
 *   - 4 products → 4 columns on lg+, 2 on md, 1 on mobile.
 * Mobile always stacks single-column.
 *
 * Visual hierarchy: a 2px top accent border in muted sky distinguishes the
 * card from surrounding content blocks without changing its dark background
 * — signals "curated section" rather than "ad banner." The SPONSORED label +
 * Amazon Associates disclosure handle FTC requirements.
 *
 * Returns null when AFFILIATE_LINKS_ENABLED is false so callsites can stay
 * embedded without exposing placeholder Amazon URLs.
 *
 * @param {Object} props
 * @param {keyof typeof ESSENTIALS_CARD_VARIANTS} props.variant
 * @param {string} props.placement   Analytics placement tag (e.g. 'homepage', 'state-fl', 'radar')
 */
export default function EssentialsCard({ variant, placement }) {
  if (!AFFILIATE_LINKS_ENABLED) return null;

  const config = ESSENTIALS_CARD_VARIANTS[variant];
  if (!config) return null;

  const products = config.productIds
    .map(id => getProductById(id))
    .filter(Boolean);

  if (products.length === 0) return null;

  // Column count adapts to product count. Both class strings written out
  // verbatim so Tailwind's content scanner picks them up — dynamic class
  // construction (`lg:grid-cols-${n}`) wouldn't be detected.
  const gridColsClass = products.length === 4
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section
      aria-labelledby={`essentials-card-${variant}-heading`}
      className="rounded-xl border border-slate-700 border-t-2 border-t-sky-500/50 bg-slate-800/60 p-5 sm:p-6 shadow-sm shadow-sky-500/5"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3
          id={`essentials-card-${variant}-heading`}
          className="text-lg font-semibold text-white"
        >
          {config.title}
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 flex-shrink-0">Sponsored</span>
      </div>

      {config.intro && (
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {config.intro}
        </p>
      )}

      <div className={`grid gap-3 mb-5 ${gridColsClass} ${!config.intro ? 'mt-2' : ''}`}>
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

      <div className="flex justify-center">
        <Link
          to="/prep"
          onClick={() => trackEssentialsCardClick('view-full-guide', placement)}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-sky-200 text-sm font-semibold rounded-lg transition-colors"
        >
          View full prep guide
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <p className="mt-4 pt-4 border-t border-slate-700 text-[10px] text-slate-500 leading-relaxed text-center sm:text-left">
        As an Amazon Associate, StormTracking earns from qualifying purchases. We only list things we'd buy ourselves.
      </p>
    </section>
  );
}
