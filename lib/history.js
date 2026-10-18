// Recent orders kept on this device only (the page stores the list in localStorage; nothing is sent).
// An entry is the order's link query and when it was last opened; the name and custom shown in the list
// are read back from the query with lib/template.js, so the link stays the one source for both.

export const HISTORY_LIMIT = 20;

const isEntry = (e) => e && typeof e.id === 'string' && typeof e.query === 'string' && e.query && Number.isFinite(e.at);

// Whatever storage held, as a clean newest-first list (a damaged or foreign value reads as empty).
export function parseHistory(raw) {
  try {
    const list = JSON.parse(raw ?? '[]');
    return Array.isArray(list) ? list.filter(isEntry).sort((a, b) => b.at - a.at).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

// An order was opened. Opening the same link again moves it to the top; `replaceId` is the entry the
// reader was on when they edited it, so the edited order replaces it instead of adding a second one.
export function recordVisit(entries, { query, at }, { replaceId = null, newId = () => `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}` } = {}) {
  const current = (replaceId && entries.find((e) => e.id === replaceId)) || entries.find((e) => e.query === query);
  const id = current?.id ?? newId();
  const rest = entries.filter((e) => e.id !== id && e.query !== query);
  return { entries: [{ id, query, at }, ...rest].slice(0, HISTORY_LIMIT), id };
}

export function removeEntry(entries, id) {
  return entries.filter((e) => e.id !== id);
}
