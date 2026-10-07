const STORAGE_KEY = 'zevooria_recently_viewed';
const LIMIT = 6;

export function getRecentlyViewedSlugs(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function recordProductView(slug: string): string[] {
  if (typeof window === 'undefined' || !slug) {
    return [];
  }
  const next = [
    slug,
    ...getRecentlyViewedSlugs().filter((item) => item !== slug),
  ].slice(0, LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures.
  }
  return next;
}
