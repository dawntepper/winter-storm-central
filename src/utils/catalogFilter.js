/**
 * Prefix-match catalog labels (city names). Substring typos (e.g. "hicago")
 * do not match; only names or word prefixes starting with the query match.
 */
export function filterCatalogByPrefix(query, items, getLabel = (item) => item) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const label = String(getLabel(item) || '').toLowerCase();
    if (label.startsWith(q)) return true;
    return label.split(/\s+/).some((word) => word.startsWith(q));
  });
}
