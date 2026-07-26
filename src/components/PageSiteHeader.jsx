import { Link } from 'react-router-dom';
import PageBackNav from './PageBackNav';
import PageHeaderNav from './PageHeaderNav';

/**
 * Shared page chrome header.
 * Mobile (< md): primary nav row above Home / StormTracking brand row.
 * Desktop (md+): brand left, nav right — unchanged hierarchy.
 */
export default function PageSiteHeader({
  source,
  currentStateSlug = null,
  showStateDropdown = true,
  showBrand = true,
  maxWidthClass = 'max-w-7xl',
  className = 'bg-slate-900 border-b border-slate-700 px-3 sm:px-6 py-2 sm:py-3',
  children = null,
  /** Optional custom nav cluster (e.g. ForecastCityLayout headerNav). */
  nav = null,
}) {
  return (
    <header className={className}>
      <div
        className={`${maxWidthClass} mx-auto flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-4`}
      >
        <div className="order-1 md:order-2 w-full md:w-auto min-w-0">
          {nav ?? (
            <PageHeaderNav
              source={source}
              currentStateSlug={currentStateSlug}
              showStateDropdown={showStateDropdown}
              className="w-full justify-between md:w-auto md:justify-end"
            />
          )}
        </div>
        <div className="order-2 md:order-1 flex items-center gap-3 sm:gap-4 min-w-0">
          <PageBackNav />
          {showBrand && (
            <Link
              to="/"
              className="flex items-center gap-2 text-white hover:text-sky-300 transition-colors min-w-0"
            >
              <span className="text-xl" aria-hidden="true">📡</span>
              <span className="text-lg sm:text-xl font-bold truncate">StormTracking</span>
            </Link>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
