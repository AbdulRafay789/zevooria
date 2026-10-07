import assert from 'node:assert/strict';
import test from 'node:test';
import { descriptionToListItems } from './product-description';

test('parses ul/li description into items', () => {
  const items = descriptionToListItems(
    '<ul>\n  <li>Top notes of citrus</li>\n  <li>Warm amber dry-down</li>\n</ul>',
  );
  assert.deepEqual(items, ['Top notes of citrus', 'Warm amber dry-down']);
});

test('keeps single prose as one item', () => {
  assert.deepEqual(descriptionToListItems('A velvet oud.'), ['A velvet oud.']);
});
