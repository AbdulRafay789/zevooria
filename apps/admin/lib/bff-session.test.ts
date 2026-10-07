import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractAdminAuthToken,
  isAdminAuthLoginPath,
  isAdminAuthLogoutPath,
  isAdminSsePath,
} from './bff-session';

test('recognizes login, logout, and SSE paths', () => {
  assert.equal(isAdminAuthLoginPath(['api', 'admin', 'auth', 'login']), true);
  assert.equal(
    isAdminAuthLogoutPath(['api', 'admin', 'auth', 'logout']),
    true,
  );
  assert.equal(
    isAdminSsePath(['api', 'admin', 'notifications', 'stream']),
    true,
  );
});

test('strips token from admin login JSON', () => {
  const extracted = extractAdminAuthToken({
    token: 'admin-access',
    user: { id: '1', email: 'ops@x.com', role: 'admin' },
  });
  assert.equal(extracted?.token, 'admin-access');
  assert.deepEqual(extracted?.body, {
    user: { id: '1', email: 'ops@x.com', role: 'admin' },
  });
  assert.equal(extractAdminAuthToken({ user: {} }), null);
});
