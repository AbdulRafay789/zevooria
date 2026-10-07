import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractAuthTokens,
  isWebAuthLogoutPath,
  isWebAuthRefreshPath,
  isWebAuthSessionPath,
} from './bff-session';

test('recognizes auth session and logout paths', () => {
  assert.equal(isWebAuthSessionPath(['api', 'auth', 'login']), true);
  assert.equal(isWebAuthSessionPath(['api', 'auth', 'refresh']), true);
  assert.equal(isWebAuthRefreshPath(['api', 'auth', 'refresh']), true);
  assert.equal(isWebAuthLogoutPath(['api', 'auth', 'logout']), true);
  assert.equal(isWebAuthSessionPath(['api', 'orders']), false);
});

test('strips tokens from auth JSON payloads', () => {
  const extracted = extractAuthTokens({
    token: 'access',
    refreshToken: 'refresh',
    expiresAt: '2026-01-01T00:00:00.000Z',
    expiresIn: 300,
    user: { id: '1', email: 'a@b.com' },
  });
  assert.equal(extracted?.token, 'access');
  assert.equal(extracted?.refreshToken, 'refresh');
  assert.deepEqual(extracted?.body, {
    user: { id: '1', email: 'a@b.com' },
    expiresAt: '2026-01-01T00:00:00.000Z',
    expiresIn: 300,
  });
  assert.equal(extractAuthTokens({ user: {} }), null);
});
