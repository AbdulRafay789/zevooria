/**
 * Public storefront base URL for customer-facing links (product QR codes).
 * Prefer WEB_PUBLIC_URL; fall back to local web for development.
 */
export function getWebPublicBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw =
    env.WEB_PUBLIC_URL?.trim() ||
    env.NEXT_PUBLIC_WEB_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export function productPageUrl(
  slug: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const encoded = encodeURIComponent(slug);
  return `${getWebPublicBaseUrl(env)}/products/${encoded}`;
}
