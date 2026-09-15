/**
 * Builds a URL-friendly slug from a display name.
 * Callers must ensure uniqueness (append suffix when needed).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Ensures a unique slug within an existing set.
 */
export function uniqueSlug(base: string, existing: Set<string>): string {
  const root = slugify(base);
  if (!existing.has(root)) {
    existing.add(root);
    return root;
  }

  let n = 2;
  while (existing.has(`${root}-${n}`)) {
    n += 1;
  }
  const candidate = `${root}-${n}`;
  existing.add(candidate);
  return candidate;
}
