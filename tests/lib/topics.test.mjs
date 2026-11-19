import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileStates, tileRows, hiddenUntil } from '../../src/lib/topics.js';

test('a topic with default answers shows a count at Off and grows with the dial', () => {
  assert.deepEqual(tileStates({ none: 3, mild: 1 }), [{ levels: 'off places', count: 3, until: '' }, { levels: 'mild', count: 4, until: '' }]);
  assert.deepEqual(tileStates({ none: 2 }), [{ levels: 'off places mild', count: 2, until: '' }]);
});

test('a topic with answers only at a higher level is never a zero count: it says which level opens it', () => {
  assert.deepEqual(tileStates({ mild: 1 }), [{ levels: 'off places', count: 0, until: 'Mild' }, { levels: 'mild', count: 1, until: '' }]);
  assert.deepEqual(tileStates({ places: 2, mild: 1 }), [{ levels: 'off', count: 0, until: 'Places' }, { levels: 'places', count: 2, until: '' }, { levels: 'mild', count: 3, until: '' }]);
  assert.equal(hiddenUntil({ mild: 1 }), 'Mild');
  assert.equal(hiddenUntil({ places: 1 }), 'Places');
  assert.equal(hiddenUntil({ none: 1, mild: 1 }), '');
});

test('a topic with nothing anywhere has no level to point to', () => {
  assert.deepEqual(tileStates({}), [{ levels: 'off places mild', count: 0, until: '' }]);
});

test('a topic with nothing at Off renders a closed row and one open row, and no row carries a count', () => {
  const rows = tileRows({ places: 2, mild: 1 });
  assert.deepEqual(rows, [{ levels: 'off', count: 0, until: 'Places', open: false }, { levels: 'places mild', open: true, until: '' }]);
  assert.deepEqual(tileRows({ mild: 1 }), [{ levels: 'off places', count: 0, until: 'Mild', open: false }, { levels: 'mild', open: true, until: '' }]);
  assert.equal(JSON.stringify(rows.filter((r) => r.open)).includes('count'), false); // the open row holds no number at all
});

test('topics that open at Off, or that hold nothing anywhere, keep their tile states', () => {
  assert.deepEqual(tileRows({ none: 3, mild: 1 }).map((r) => r.open), [true, true]);
  assert.deepEqual(tileRows({}), [{ levels: 'off places mild', count: 0, until: '', open: false }]);
});
