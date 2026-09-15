import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canGoNext,
  canGoPrevious,
  getActiveImageIndex,
  reduceLightboxState,
  resolveLightboxKeyAction,
  stepLightboxIndex,
  type LightboxState,
} from './product-gallery-logic';

const images = [
  { storageKey: 'assets/a/1.jpeg' },
  { storageKey: 'assets/a/2.jpeg' },
  { storageKey: 'assets/a/3.jpeg' },
];

test('getActiveImageIndex resolves selected and falls back to first', () => {
  assert.equal(getActiveImageIndex(images, 'assets/a/2.jpeg'), 1);
  assert.equal(getActiveImageIndex(images, 'missing'), 0);
  assert.equal(getActiveImageIndex([], null), -1);
});

test('opening the lightbox sets open state and clamped index', () => {
  const closed: LightboxState = { open: false, index: 0 };
  assert.deepEqual(reduceLightboxState(closed, { type: 'open', index: 2 }, 3), {
    open: true,
    index: 2,
  });
  assert.deepEqual(reduceLightboxState(closed, { type: 'open', index: 9 }, 3), {
    open: true,
    index: 2,
  });
  assert.deepEqual(
    reduceLightboxState(closed, { type: 'open', index: 0 }, 0),
    closed,
  );
});

test('closing the lightbox clears open state', () => {
  const open: LightboxState = { open: true, index: 1 };
  assert.deepEqual(reduceLightboxState(open, { type: 'close' }, 3), {
    open: false,
    index: 1,
  });
  assert.deepEqual(
    reduceLightboxState({ open: false, index: 1 }, { type: 'close' }, 3),
    { open: false, index: 1 },
  );
});

test('previous and next navigation disable at ends', () => {
  assert.equal(canGoPrevious(0), false);
  assert.equal(canGoPrevious(1), true);
  assert.equal(canGoNext(2, 3), false);
  assert.equal(canGoNext(1, 3), true);
  assert.equal(stepLightboxIndex(0, 3, 'prev'), 0);
  assert.equal(stepLightboxIndex(0, 3, 'next'), 1);
  assert.equal(stepLightboxIndex(2, 3, 'next'), 2);

  const mid: LightboxState = { open: true, index: 1 };
  assert.deepEqual(reduceLightboxState(mid, { type: 'prev' }, 3), {
    open: true,
    index: 0,
  });
  assert.deepEqual(reduceLightboxState(mid, { type: 'next' }, 3), {
    open: true,
    index: 2,
  });
  assert.deepEqual(
    reduceLightboxState({ open: true, index: 0 }, { type: 'prev' }, 3),
    { open: true, index: 0 },
  );
});

test('keyboard Escape closes the lightbox', () => {
  assert.equal(resolveLightboxKeyAction('Escape', 1, 3), 'close');
  assert.deepEqual(
    reduceLightboxState({ open: true, index: 1 }, { type: 'key', key: 'Escape' }, 3),
    { open: false, index: 1 },
  );
});

test('keyboard arrow navigation moves within bounds', () => {
  assert.equal(resolveLightboxKeyAction('ArrowLeft', 1, 3), 'prev');
  assert.equal(resolveLightboxKeyAction('ArrowRight', 1, 3), 'next');
  assert.equal(resolveLightboxKeyAction('ArrowLeft', 0, 3), 'noop');
  assert.equal(resolveLightboxKeyAction('ArrowRight', 2, 3), 'noop');

  const open: LightboxState = { open: true, index: 1 };
  assert.deepEqual(
    reduceLightboxState(open, { type: 'key', key: 'ArrowLeft' }, 3),
    { open: true, index: 0 },
  );
  assert.deepEqual(
    reduceLightboxState(open, { type: 'key', key: 'ArrowRight' }, 3),
    { open: true, index: 2 },
  );
});

test('single-image lightbox cannot navigate and still closes', () => {
  assert.equal(canGoPrevious(0), false);
  assert.equal(canGoNext(0, 1), false);
  assert.equal(resolveLightboxKeyAction('ArrowLeft', 0, 1), 'noop');
  assert.equal(resolveLightboxKeyAction('ArrowRight', 0, 1), 'noop');

  const single: LightboxState = { open: true, index: 0 };
  assert.deepEqual(
    reduceLightboxState(single, { type: 'key', key: 'ArrowRight' }, 1),
    single,
  );
  assert.deepEqual(
    reduceLightboxState(single, { type: 'next' }, 1),
    single,
  );
  assert.deepEqual(
    reduceLightboxState(single, { type: 'key', key: 'Escape' }, 1),
    { open: false, index: 0 },
  );
});
