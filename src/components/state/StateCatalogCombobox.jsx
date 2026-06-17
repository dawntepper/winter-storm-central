import { useEffect, useId, useRef, useState } from 'react';
import { filterCatalogByPrefix } from '../../utils/catalogFilter';

const selectShellClass =
  'flex items-center gap-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus-within:border-sky-500';

const inputClass =
  'flex-1 min-w-0 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none';

/**
 * Catalog-only combobox — filters known options; selection must come from the list.
 */
export default function StateCatalogCombobox({
  label,
  placeholder,
  options,
  loading,
  disabled,
  onSelect,
  formatOption = (opt) => opt.label,
  getOptionKey = (opt) => opt.value,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = !query.trim()
    ? options
    : filterCatalogByPrefix(query, options, formatOption);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const pick = (opt) => {
    setQuery(formatOption(opt));
    setOpen(false);
    onSelect?.(opt);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIndex]) pick(filtered[highlightIndex]);
    }
  };

  const isDisabled = disabled || loading;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={listId} className="block text-xs font-medium text-slate-400">
          {label}
        </label>
      )}
      <div
        ref={rootRef}
        className={`relative${isDisabled ? ' opacity-50' : ''}`}
      >
        <div
          className={`${selectShellClass}${isDisabled ? ' cursor-not-allowed' : ' cursor-pointer'}`}
          onClick={() => {
            if (isDisabled) return;
            setOpen(true);
            inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            id={listId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={`${listId}-listbox`}
            value={query}
            readOnly={isDisabled}
            disabled={isDisabled}
            placeholder={loading ? 'Loading…' : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (!isDisabled) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={inputClass}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Open ${label || 'options'}`}
            disabled={isDisabled}
            onClick={(e) => {
              e.stopPropagation();
              if (isDisabled) return;
              setOpen((v) => !v);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed"
          >
            ▼
          </button>
        </div>
        {open && filtered.length > 0 && (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-lg"
          >
            {filtered.map((opt, index) => (
              <li key={getOptionKey(opt)} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                    index === highlightIndex
                      ? 'bg-sky-600/30 text-white'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {formatOption(opt)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && !loading && filtered.length === 0 && (
          <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-500">
            No matches — pick from the list
          </p>
        )}
      </div>
    </div>
  );
}
