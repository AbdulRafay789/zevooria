import { join, normalize, relative, resolve, sep } from 'node:path';

/**
 * Resolves a request path under ASSETS_ROOT. Rejects path traversal.
 * Request path is relative to the assets directory (e.g. crown-haider/a.jpeg),
 * matching storageKey after the leading "assets/" segment.
 */
export function resolveSafeAssetPath(
  assetsRoot: string,
  pathSegments: string[],
): string {
  if (pathSegments.length === 0) {
    throw new Error('Empty asset path');
  }

  for (const segment of pathSegments) {
    if (!segment || segment === '.' || segment === '..') {
      throw new Error('Invalid asset path segment');
    }
  }

  const root = resolve(assetsRoot);
  const candidate = resolve(root, join(...pathSegments));
  const rel = relative(root, candidate);
  const outside =
    rel.startsWith(`..${sep}`) || rel === '..' || normalize(rel).startsWith('..');

  if (outside) {
    throw new Error('Asset path escapes assets root');
  }

  return candidate;
}

export function resolveAssetsRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.ASSETS_ROOT?.trim()) {
    return resolve(env.ASSETS_ROOT.trim());
  }
  // apps/admin -> repo root assets/
  return resolve(process.cwd(), '..', '..', 'assets');
}
