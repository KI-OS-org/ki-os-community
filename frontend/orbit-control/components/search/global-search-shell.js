export function buildSearchSections(results) {
  const buckets = new Map();
  for (const item of results) {
    const list = buckets.get(item.type) || [];
    list.push(item);
    buckets.set(item.type, list);
  }
  return Array.from(buckets.entries()).map(([type, items]) => ({ type, items }));
}
