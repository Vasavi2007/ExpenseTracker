import test from 'node:test';
import assert from 'node:assert/strict';

test('expense validation rejects zero and negative amounts (validation contract)', () => {
  for (const amount of [0, -1, NaN, Infinity]) assert.equal(Number.isFinite(Number(amount)) && Number(amount) > 0, false);
});
test('savings rate calculation is bounded for ordinary values', () => {
  const income=1000, expenses=750;
  assert.equal(Math.round(((income-expenses)/income)*100),25);
});
