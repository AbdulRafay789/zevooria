import {
  RATE_LIMIT_AUTH_PER_MIN,
  RATE_LIMIT_READ_PER_MIN,
  RATE_LIMIT_WRITE_PER_MIN,
  isAuthSensitivePath,
  isRateLimitExemptPath,
  resolveRateLimitForRequest,
} from './rate-limit';

describe('resolveRateLimitForRequest', () => {
  it('gives read endpoints the high GET limit', () => {
    expect(
      resolveRateLimitForRequest({
        method: 'GET',
        pathOrUrl: '/api/products',
      }),
    ).toEqual({ limit: RATE_LIMIT_READ_PER_MIN, bucket: 'read' });
  });

  it('gives generic writes the medium write limit', () => {
    expect(
      resolveRateLimitForRequest({
        method: 'POST',
        pathOrUrl: '/api/orders',
      }),
    ).toEqual({ limit: RATE_LIMIT_WRITE_PER_MIN, bucket: 'write' });
  });

  it('gives auth endpoints the strict auth limit', () => {
    expect(
      resolveRateLimitForRequest({
        method: 'POST',
        pathOrUrl: '/api/auth/login',
      }),
    ).toEqual({ limit: RATE_LIMIT_AUTH_PER_MIN, bucket: 'auth' });
    expect(isAuthSensitivePath('/api/admin/auth/login')).toBe(true);
  });

  it('exempts health and notification streams', () => {
    expect(isRateLimitExemptPath('/api/health')).toBe(true);
    expect(isRateLimitExemptPath('/api/admin/notifications/stream')).toBe(true);
  });
});
