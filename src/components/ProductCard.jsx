import { trackAffiliateClick } from '../utils/analytics';

/**
 * Full-width product card used on the /prep page.
 *
 * Light surface (slate-50) on the dark site shell — affiliate-trustworthy
 * card convention. Featured cards get a sky accent border + "Our pick" badge.
 * Pet-section cards get a warm rose tint passed via the `accent` prop.
 *
 * Click → opens Amazon URL in a new tab with rel="noopener noreferrer sponsored"
 * (sponsored is important for SEO compliance) and fires 'Affiliate Click' with
 * full product/category/tier/placement props.
 *
 * @param {Object} props
 * @param {import('../data/affiliateProducts').AffiliateProduct} props.product
 * @param {string} props.placement   Analytics placement, typically 'prep-page'
 * @param {'default'|'pet'} [props.accent='default']
 */
export default function ProductCard({ product, placement, accent = 'default' }) {
  const {
    productId,
    productName,
    category,
    tier,
    price,
    priceDescriptor,
    description,
    amazonUrl,
    isFeatured,
  } = product;

  const handleClick = () => {
    trackAffiliateClick(productId, category, tier, placement);
  };

  const isPet = accent === 'pet';
  const borderClass = isFeatured
    ? 'border-sky-500 border-2'
    : isPet
      ? 'border-rose-200'
      : 'border-slate-200';
  const cardBg = isPet ? 'bg-white/95' : 'bg-slate-50';

  return (
    <div className="flex flex-col h-full">
      {isFeatured && (
        <span className="self-start inline-block mb-2 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-sky-100 text-sky-700 rounded">
          Our pick
        </span>
      )}
      <div className={`flex-1 flex flex-col rounded-xl border ${borderClass} ${cardBg} p-5 shadow-sm`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
          {priceDescriptor} · <span className="text-slate-900">{price}</span>
        </div>
        <h3 className="text-[15px] font-medium text-slate-900 mb-2">{productName}</h3>
        <p className="text-[13px] text-slate-600 leading-relaxed flex-1 mb-4">{description}</p>
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          aria-label={`Check ${productName} on Amazon (opens in new tab)`}
        >
          Check on Amazon
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
