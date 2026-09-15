import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPostgresSslOptions } from './postgres-ssl';

describe('buildPostgresSslOptions', () => {
  it('returns false when DB_SSL is not true', () => {
    expect(buildPostgresSslOptions({ DB_SSL: 'false' })).toBe(false);
    expect(buildPostgresSslOptions({})).toBe(false);
  });

  it('requires DB_SSL_CA when SSL is enabled', () => {
    expect(() => buildPostgresSslOptions({ DB_SSL: 'true' })).toThrow(
      /DB_SSL_CA/,
    );
  });

  it('loads the CA file and keeps rejectUnauthorized true', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zevooria-ssl-'));
    const caPath = join(dir, 'global-bundle.pem');
    writeFileSync(
      caPath,
      '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n',
    );

    try {
      const ssl = buildPostgresSslOptions({
        DB_SSL: 'true',
        DB_SSL_CA: caPath,
      });

      expect(ssl).not.toBe(false);
      if (ssl === false) {
        return;
      }
      expect(ssl.rejectUnauthorized).toBe(true);
      expect(ssl.ca).toContain('BEGIN CERTIFICATE');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
