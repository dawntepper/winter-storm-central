import { useMemo, useState } from 'react';

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-sm text-slate-500">
        {message}
      </td>
    </tr>
  );
}

function compareValues(a, b, sortKey) {
  const va = a[sortKey];
  const vb = b[sortKey];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return String(va).localeCompare(String(vb));
}

export default function SortableDataTable({
  columns,
  rows,
  emptyMessage,
  defaultSortKey,
  defaultSortDir = 'desc',
  compact = false,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultSortDir);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => compareValues(a, b, sortKey));
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const cellClass = compact ? 'py-1.5 pr-3 text-xs' : 'py-2 pr-4';

  return (
    <div className="overflow-x-auto -mx-1">
      <table className={`w-full ${compact ? 'text-xs' : 'text-sm'}`}>
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-700">
            {columns.map((col) => (
              <th key={col.key} className={`${cellClass} font-medium`}>
                {col.sortable !== false ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-sky-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-200">
          {sortedRows.length === 0 ? (
            <EmptyRow colSpan={columns.length} message={emptyMessage} />
          ) : (
            sortedRows.map((row, i) => (
              <tr key={row.id ?? i} className="border-b border-slate-800/80">
                {columns.map((col) => (
                  <td key={col.key} className={`${cellClass} align-top`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
