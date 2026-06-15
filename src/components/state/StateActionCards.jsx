import { trackStateQuickActionClicked } from '../../utils/analytics';

function ChevronIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function RadarIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 3a9 9 0 109 9M12 7a5 5 0 105 5M12 11a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}

function CityIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01"
      />
    </svg>
  );
}

function MapIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

const THEMES = {
  green: {
    card: 'bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/45 hover:bg-emerald-500/15',
    iconWrap: 'bg-emerald-500/20 text-emerald-400',
    title: 'text-emerald-400',
    chevron: 'text-emerald-400',
  },
  blue: {
    card: 'bg-sky-500/10 border-sky-500/25 hover:border-sky-500/45 hover:bg-sky-500/15',
    iconWrap: 'bg-sky-500/20 text-sky-400',
    title: 'text-sky-400',
    chevron: 'text-sky-400',
  },
  purple: {
    card: 'bg-violet-500/10 border-violet-500/25 hover:border-violet-500/45 hover:bg-violet-500/15',
    iconWrap: 'bg-violet-500/20 text-violet-400',
    title: 'text-violet-400',
    chevron: 'text-violet-400',
  },
};

function ActionCard({ theme, icon: Icon, title, subtitle, onClick }) {
  const colors = THEMES[theme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 sm:gap-4 rounded-xl border px-4 py-4 sm:py-5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${colors.card}`}
    >
      <span
        className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full ${colors.iconWrap}`}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base sm:text-lg font-bold ${colors.title}`}>{title}</span>
        <span className="mt-0.5 block text-xs sm:text-sm text-slate-400 leading-snug">{subtitle}</span>
      </span>
      <ChevronIcon className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${colors.chevron}`} />
    </button>
  );
}

/**
 * Prominent above-the-fold action cards for state alert pages.
 */
export default function StateActionCards({ stateCode, stateName, onRadar, onSelectCity, onCounties }) {
  const track = (actionType) => {
    trackStateQuickActionClicked({ state: stateCode, actionType });
  };

  return (
    <nav aria-label="Quick actions" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      <ActionCard
        theme="green"
        icon={RadarIcon}
        title="Live Radar"
        subtitle="View precipitation and storm activity"
        onClick={() => {
          track('radar');
          onRadar?.();
        }}
      />
      <ActionCard
        theme="blue"
        icon={CityIcon}
        title="Select City"
        subtitle="Get alerts and forecasts for your location"
        onClick={() => {
          track('select_city');
          onSelectCity?.();
        }}
      />
      <ActionCard
        theme="purple"
        icon={MapIcon}
        title="Counties"
        subtitle={`Browse alerts by ${stateName} county`}
        onClick={() => {
          track('counties');
          onCounties?.();
        }}
      />
    </nav>
  );
}
