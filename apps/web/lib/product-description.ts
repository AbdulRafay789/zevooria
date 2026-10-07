/**
 * Parse product description into safe list items for storefront rendering.
 */

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function descriptionToListItems(description: string): string[] {
  const trimmed = (description ?? '').trim();
  if (!trimmed) {
    return [];
  }

  const liMatches = [...trimmed.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length > 0) {
    return liMatches
      .map((match) => stripTags(match[1] ?? ''))
      .filter(Boolean);
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }

  return [stripTags(trimmed) || trimmed];
}
