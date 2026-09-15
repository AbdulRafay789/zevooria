import { readFileSync } from 'node:fs';
import type { TlsOptions } from 'node:tls';

export type PostgresSslEnv = {
  DB_SSL?: string;
  DB_SSL_CA?: string;
};

/**
 * Builds node-postgres / TypeORM SSL options.
 * When SSL is enabled, certificate verification stays on and an explicit CA
 * bundle path (DB_SSL_CA) is required so RDS Amazon CA chains verify correctly.
 */
export function buildPostgresSslOptions(
  env: PostgresSslEnv = process.env,
): false | TlsOptions {
  if (env.DB_SSL !== 'true') {
    return false;
  }

  const caPath = env.DB_SSL_CA?.trim();
  if (!caPath) {
    throw new Error(
      'DB_SSL=true requires DB_SSL_CA to point at a trusted CA bundle (e.g. AWS RDS global-bundle.pem). Certificate verification will not be disabled.',
    );
  }

  const ca = readFileSync(caPath, 'utf8');
  return {
    rejectUnauthorized: true,
    ca,
  };
}
