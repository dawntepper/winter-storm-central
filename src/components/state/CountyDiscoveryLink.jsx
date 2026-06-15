/**
 * Secondary county discovery link — sits below the location search card.
 */
export default function CountyDiscoveryLink({ stateName, onBrowseCounties }) {
  return (
    <p className="text-sm text-slate-400">
      Looking for county alerts?{' '}
      <button
        type="button"
        onClick={onBrowseCounties}
        className="text-sky-400 hover:text-sky-300 font-medium transition-colors cursor-pointer"
      >
        Browse {stateName} counties →
      </button>
    </p>
  );
}
