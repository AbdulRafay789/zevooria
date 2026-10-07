import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolves the local product-media assets root.
 * Prefer ASSETS_ROOT (Compose/production). Fall back to common repo layouts.
 * When ASSETS_ROOT is set, create it if missing so uploads can proceed.
 */
export function resolveAssetsRoot(cwd = process.cwd()): string {
  const fromEnv = process.env.ASSETS_ROOT?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      mkdirSync(fromEnv, { recursive: true });
    }
    return fromEnv;
  }

  const candidates = [
    join(cwd, 'assets'),
    join(cwd, '..', '..', 'assets'),
    join(cwd, '..', 'assets'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not locate assets directory (set ASSETS_ROOT). cwd=${cwd}`,
  );
}
