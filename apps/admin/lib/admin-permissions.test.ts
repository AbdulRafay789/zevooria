import assert from 'node:assert/strict';
import test from 'node:test';
import {
  firstAllowedPath,
  hasPermission,
  permissionForPath,
  visibleNavItems,
} from './admin-permissions';

test('hasPermission denies by default', () => {
  assert.equal(hasPermission(null, 'orders:read'), false);
  assert.equal(hasPermission({ permissions: [] }, 'orders:read'), false);
  assert.equal(
    hasPermission({ permissions: ['orders:read'] }, 'dashboard:read'),
    false,
  );
  assert.equal(
    hasPermission({ permissions: ['orders:read'] }, 'orders:read'),
    true,
  );
});

test('orders-only staff sees only Orders nav', () => {
  const user = { permissions: ['orders:read'] };
  const nav = visibleNavItems(user);
  assert.deepEqual(
    nav.map((item) => item.href),
    ['/orders'],
  );
  assert.equal(firstAllowedPath(user), '/orders');
  assert.equal(permissionForPath('/'), 'dashboard:read');
  assert.equal(permissionForPath('/orders'), 'orders:read');
  assert.equal(permissionForPath('/notifications'), 'notifications:read');
});

test('support nav requires support:read and gates detail routes', () => {
  const none = visibleNavItems({ permissions: ['orders:read'] });
  assert.equal(
    none.some((item) => item.href === '/support'),
    false,
  );

  const withSupport = visibleNavItems({ permissions: ['support:read'] });
  assert.equal(
    withSupport.some((item) => item.href === '/support'),
    true,
  );
  assert.equal(permissionForPath('/support'), 'support:read');
  assert.equal(
    permissionForPath('/support/11111111-1111-4111-8111-111111111111'),
    'support:read',
  );
  assert.equal(
    hasPermission({ permissions: ['support:read'] }, 'support:update'),
    false,
  );
  assert.equal(
    hasPermission(
      { permissions: ['support:read', 'support:update'] },
      'support:update',
    ),
    true,
  );
});
