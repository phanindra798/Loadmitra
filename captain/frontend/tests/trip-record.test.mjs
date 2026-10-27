import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/features/captain/trip-record.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { latestTrip, mergeTrips, isActiveTrip } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const trip = (changes = {}) => ({ id: 'LM-ONE', status: 'accepted', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...changes });
test('all unfinished stages are active, and terminal trips are historical', () => {
  for (const status of ['accepted', 'enroute_pickup', 'at_pickup', 'picked', 'enroute_drop']) assert.equal(isActiveTrip(trip({ status })), true);
  for (const status of ['delivered', 'cancelled']) assert.equal(isActiveTrip(trip({ status })), false);
});
test('a delayed read cannot undo a newer successful handover', () => {
  const saved = trip({ status: 'picked', updatedAt: '2026-01-02T00:00:00Z' });
  assert.equal(latestTrip(saved, trip()), saved);
});
test('a newer shipper cancellation replaces the active trip', () => {
  assert.equal(latestTrip(trip(), trip({ status: 'cancelled', updatedAt: '2026-01-02T00:00:00Z' })).status, 'cancelled');
});
test('equal or missing timestamps do not roll back lifecycle progress', () => {
  for (const updatedAt of [undefined, '2026-01-01T00:00:00Z']) {
    const saved = trip({ status: 'delivered', updatedAt });
    assert.equal(latestTrip(saved, trip({ updatedAt })).status, 'delivered');
  }
});
test('overlapping history, detail and mutation results are deduplicated and sorted', () => {
  const records = mergeTrips([trip()], [trip({ status: 'picked' }), trip({ id: 'LM-TWO', createdAt: '2026-01-02T00:00:00Z' })]);
  assert.equal(records.length, 2); assert.equal(records[0].id, 'LM-TWO'); assert.equal(records[1].status, 'picked');
});
test('empty history remains empty, and first direct recovery is preserved', () => {
  assert.deepEqual(mergeTrips([], []), []); const record = trip(); assert.equal(latestTrip(undefined, record), record);
});
