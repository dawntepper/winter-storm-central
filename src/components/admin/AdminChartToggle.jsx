export default function AdminChartToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-0.5 shrink-0">
      {[
        { id: 'table', label: 'Table' },
        { id: 'visual', label: 'Visual' },
      ].map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            value === mode.id
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
