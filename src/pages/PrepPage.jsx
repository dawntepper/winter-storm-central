import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AFFILIATE_PRODUCTS,
  AFFILIATE_CATEGORIES,
  getProductsByCategory,
} from '../data/affiliateProducts';
import ProductCard from '../components/ProductCard';
import ContactLink from '../components/ContactLink';
import { trackAlertSignup, trackAlertSignupError } from '../utils/analytics';

const SUBSCRIBER_KEY = 'stormtracking_subscriber';

// Inline newsletter form for the /prep page. Uses the same /api/subscribe-alerts
// endpoint, same analytics events, and same SUBSCRIBER_KEY as the site-wide
// AlertSignupBar slide-up — so signing up here also dismisses the slide-up bar
// on other pages.
function InlineNewsletterForm() {
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim();
    const cleanZip = zipCode.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!cleanZip || !/^\d{5}$/.test(cleanZip)) {
      setErrorMsg('Please enter a valid 5-digit zip code');
      return;
    }
    setStatus('submitting');
    try {
      const response = await fetch('/api/subscribe-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, zip_code: cleanZip }),
      });
      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try {
          const data = await response.json();
          msg = data.error || msg;
        } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      localStorage.setItem(SUBSCRIBER_KEY, JSON.stringify({ email: cleanEmail, zip: cleanZip }));
      setStatus('success');
      trackAlertSignup({ type: 'new', zipCode: cleanZip });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      trackAlertSignupError(err.message || 'Unknown error');
    }
  };

  if (status === 'success') {
    return (
      <p className="text-emerald-300 font-medium text-sm sm:text-base">
        You're signed up. We'll only email when there's a reason to.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto" aria-label="Newsletter signup">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
        aria-label="Email address"
        className="flex-1 min-w-0 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
      />
      <input
        type="text"
        value={zipCode}
        onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
        placeholder="Zip code"
        required
        maxLength={5}
        aria-label="Zip code"
        className="w-full sm:w-28 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
      >
        {status === 'submitting' ? 'Signing up...' : 'Sign me up'}
      </button>
      {errorMsg && (
        <p className="basis-full text-red-400 text-xs mt-1">{errorMsg}</p>
      )}
    </form>
  );
}

const PAGE_TITLE = 'Extreme Weather Prep Guide | StormTracking';
const PAGE_DESCRIPTION = 'Recommended gear for hurricane season, severe weather, and extended outages. Honest reviews from a weather site that focuses on multi-hazard preparedness. We may earn from qualifying purchases.';
const CANONICAL_URL = 'https://stormtracking.io/prep';

function setPrepMetaTags() {
  document.title = PAGE_TITLE;
  const setOrCreate = (selector, attr, value) => {
    let el = document.querySelector(selector);
    if (!el) {
      const [tag, prop] = selector.match(/^(\w+)\[([^=]+)=/)?.slice(1) || [];
      if (!tag || !prop) return;
      el = document.createElement(tag);
      const propValue = selector.match(/=["']?([^"'\]]+)/)?.[1];
      if (propValue) el.setAttribute(prop, propValue);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };

  setOrCreate('meta[name="description"]', 'content', PAGE_DESCRIPTION);
  setOrCreate('link[rel="canonical"]', 'href', CANONICAL_URL);
  setOrCreate('meta[property="og:title"]', 'content', PAGE_TITLE);
  setOrCreate('meta[property="og:description"]', 'content', PAGE_DESCRIPTION);
  setOrCreate('meta[property="og:url"]', 'content', CANONICAL_URL);
  setOrCreate('meta[name="twitter:title"]', 'content', PAGE_TITLE);
  setOrCreate('meta[name="twitter:description"]', 'content', PAGE_DESCRIPTION);
}

function resetPrepMetaTags() {
  document.title = 'StormTracking - Real-Time Extreme Weather Alerts';
}

const SCHEMA_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Extreme Weather Prep Guide',
  description: 'Recommended gear for hurricane season, severe weather, and extended outages',
  url: CANONICAL_URL,
  datePublished: '2026-05-27',
  publisher: {
    '@type': 'Organization',
    name: 'StormTracking',
    url: 'https://stormtracking.io',
  },
};

export default function PrepPage() {
  // Detect when the sticky anchor nav has actually stuck to the viewport top
  // (vs. still scrolling with the page) so we can shift its background to a
  // sky-blue tint as a "you're now navigating" affordance. Uses a 1px sentinel
  // element placed just above the nav; when the sentinel scrolls out of view,
  // the nav has become sticky.
  const navSentinelRef = useRef(null);
  const [isNavStuck, setIsNavStuck] = useState(false);

  useEffect(() => {
    setPrepMetaTags();
    return () => resetPrepMetaTags();
  }, []);

  useEffect(() => {
    const sentinel = navSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNavStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ ...SCHEMA_JSON_LD, dateModified: new Date().toISOString().slice(0, 10) }) }}
      />

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline text-sm">Home</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors">
            <span className="text-xl" aria-hidden="true">📡</span>
            <span className="text-lg sm:text-xl font-bold">StormTracking</span>
          </Link>
          <div className="w-12" aria-hidden="true" />
        </div>
      </header>

      {/* Hero */}
      <section className="bg-slate-900 px-4 sm:px-6 py-10 sm:py-14 border-b border-slate-800">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] sm:text-xs font-semibold tracking-widest text-sky-400 uppercase mb-3">
            STORMTRACKING.IO / PREP
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            Extreme weather prep, recommended
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Hurricane season opens in 12 days. Severe weather happens year-round.
            Tornadoes don't text first. Here's the gear we'd put in our own
            house — most of which actually IS in our own house. From Fort Myers,
            with a dog named Mackie supervising.
          </p>
        </div>
      </section>

      {/* Affiliate disclosure callout */}
      <div className="bg-sky-500/5 border-b border-sky-500/20 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-sky-100/80 leading-relaxed">
            <span className="font-semibold text-sky-200">Affiliate disclosure:</span>{' '}
            We may earn a commission from purchases through these links — at no
            extra cost to you. It helps keep StormTracking running. We never
            link to products we wouldn't actually use.
          </p>
        </div>
      </div>

      {/* Sentinel — when this 1px element scrolls out of view, the nav below
          has become sticky. The observer above flips isNavStuck accordingly. */}
      <div ref={navSentinelRef} aria-hidden="true" className="h-px" />

      {/* Sticky anchor nav */}
      <nav
        aria-label="Prep categories"
        className={`sticky top-0 z-30 backdrop-blur border-b px-4 sm:px-6 py-3 transition-colors duration-200 ${
          isNavStuck
            ? 'bg-sky-900/95 border-sky-700/50'
            : 'bg-slate-900/95 border-slate-800'
        }`}
      >
        <ul className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
          {AFFILIATE_CATEGORIES.map(cat => (
            <li key={cat.id} className="flex-shrink-0">
              <a
                href={`#${cat.anchor}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-full border border-slate-700 transition-colors whitespace-nowrap"
              >
                <span aria-hidden="true">{cat.icon}</span>
                {cat.navLabel}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Category sections */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {AFFILIATE_CATEGORIES.map(cat => {
          const products = getProductsByCategory(cat.id);
          const isPet = cat.isPetSection;
          const sectionBg = isPet ? 'bg-rose-50' : 'bg-slate-100';
          const sectionBorder = isPet ? 'border-rose-200' : 'border-slate-200';
          const titleColor = isPet ? 'text-rose-900' : 'text-slate-900';
          const descColor = isPet ? 'text-rose-800/80' : 'text-slate-600';

          return (
            <section
              key={cat.id}
              id={cat.anchor}
              aria-labelledby={`${cat.anchor}-heading`}
              className={`scroll-mt-20 rounded-2xl border ${sectionBorder} ${sectionBg} p-6 sm:p-8`}
            >
              <header className="mb-6 sm:mb-8">
                {isPet ? (
                  // Pet section header includes a Mackie photo slot integrated
                  // with the coral background. Image lives at public/mackie.jpg;
                  // if missing, the coral placeholder behind shows through.
                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-rose-100">
                      <div className="absolute inset-0 flex items-center justify-center text-center px-2">
                        <span className="text-rose-700 text-xs font-medium leading-tight">
                          <span className="text-3xl block mb-1" aria-hidden="true">🐕</span>
                          Mackie
                        </span>
                      </div>
                      <img
                        src="/mackie.jpg"
                        alt="Mackie, our resident prep supervisor"
                        loading="lazy"
                        className="relative w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl" aria-hidden="true">{cat.icon}</span>
                        <h2 id={`${cat.anchor}-heading`} className={`text-xl sm:text-2xl font-bold ${titleColor}`}>
                          {cat.title}
                        </h2>
                      </div>
                      <p className={`text-sm sm:text-base ${descColor} leading-relaxed max-w-2xl`}>
                        {cat.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl" aria-hidden="true">{cat.icon}</span>
                      <h2 id={`${cat.anchor}-heading`} className={`text-xl sm:text-2xl font-bold ${titleColor}`}>
                        {cat.title}
                      </h2>
                    </div>
                    <p className={`text-sm sm:text-base ${descColor} leading-relaxed max-w-2xl`}>
                      {cat.description}
                    </p>
                  </>
                )}
                {cat.personalNote && (
                  <p className={`mt-3 italic text-sm ${descColor} leading-relaxed max-w-2xl`}>
                    {cat.personalNote}
                  </p>
                )}
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                {products.map(product => (
                  <ProductCard
                    key={product.productId}
                    product={product}
                    placement="prep-page"
                    accent={isPet ? 'pet' : 'default'}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Newsletter — inline form using the same /api/subscribe-alerts endpoint
          as the site-wide slide-up. The slide-up is intentionally NOT mounted
          on /prep (would be double signup noise next to the inline form). */}
      <section className="bg-slate-800 border-y border-slate-700 px-4 sm:px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
            Get the StormTracking newsletter
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
            Weekly during hurricane season. Free, no spam, no urgency manufactured.
          </p>
          <InlineNewsletterForm />
          <p className="text-xs text-slate-500 mt-4">
            Questions? Reach out via{' '}
            <ContactLink className="text-sky-400 hover:text-sky-300">StormTracking Support</ContactLink>.
          </p>
        </div>
      </section>

      {/* FTC disclosure footer */}
      <footer className="bg-slate-900 px-4 sm:px-6 py-10 border-t border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
            Affiliate disclosure
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            As an Amazon Associate, StormTracking earns from qualifying
            purchases. The commission we earn helps fund hosting, storm data
            feeds, and content development. Affiliate relationships never
            influence our product recommendations — we only list things we'd
            actually buy ourselves. If we wouldn't recommend it to a friend,
            it doesn't go on this page.
          </p>
          <p className="text-xs text-slate-500 mt-4">
            Showing {AFFILIATE_PRODUCTS.length} products across {AFFILIATE_CATEGORIES.length} categories.
            Last updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </footer>
    </div>
  );
}
