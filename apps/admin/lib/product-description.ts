/**
 * Product descriptions are stored as a simple HTML list:
 * <ul><li>…</li></ul>
 * Admin edits line items; storefront renders React <ul>/<li> (no raw HTML inject).
 */

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function descriptionToListItems(description: string): string[] {
  const trimmed = (description ?? '').trim();
  if (!trimmed) {
    return [''];
  }

  const liMatches = [...trimmed.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  if (liMatches.length > 0) {
    const items = liMatches
      .map((match) => stripTags(match[1] ?? ''))
      .filter(Boolean);
    return items.length > 0 ? items : [''];
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }

  // Single prose block → one list item (editable as bullets by default).
  return [stripTags(trimmed) || trimmed];
}

export function listItemsToDescriptionHtml(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) {
    throw new Error('Add at least one description bullet.');
  }
  const body = clean.map((item) => `  <li>${escapeHtml(item)}</li>`).join('\n');
  return `<ul>\n${body}\n</ul>`;
}
