import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLocationCode, parseLocationCode } from './locationCode';

test('compact location code is parseable', () => {
  const parsed = parseLocationCode('A1-K2-P3');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.parts.rackCode, 'A1');
  assert.equal(parsed.parts.levelNumber, 2);
  assert.equal(parsed.parts.slotNumber, 3);
});

test('extended Turkish face location code is parseable', () => {
  const parsed = parseLocationCode('A1-B8-ON-K2-P3');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.parts.bayCode, 'B8');
  assert.equal(parsed.parts.face, 'front');
});

test('formatter supports compact and extended styles', () => {
  assert.equal(formatLocationCode({ rackCode: 'a1', levelNumber: 2, slotNumber: 3 }), 'A1-K2-P3');
  assert.equal(
    formatLocationCode({ rackCode: 'A1', bayCode: 'B8', face: 'back', levelNumber: 2, slotNumber: 3 }, 'extended'),
    'A1-B8-ARKA-K2-P3',
  );
});
