import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual pure TypeScript mapper without adding a test runtime dependency.
const source = await readFile(new URL('../src/features/shipper/booking-record.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { restoreBooking, mergeBookings } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const record = (changes = {}) => ({
  id: 'LM-HISTORY-1', mode: 'full', pickup: { label: 'A', address: 'Street A', city: 'Hyderabad' },
  drop: { label: 'B', address: 'Street B', city: 'Secunderabad' }, distanceKm: 100,
  truckTypeId: 'retired-truck', truckTypeName: 'Historical truck', loadWeightKg: 500,
  goodsType: 'Furniture', agreedPrice: 1777, priceSnapshot: null,
  status: 'accepted', tripStatus: 'at_pickup', captain: { id: 'captain-a', name: 'Captain' },
  createdLabel: '26 Oct 2026', createdAt: '2026-10-26T00:00:00Z', updatedAt: '2026-10-26T01:00:00Z', ...changes,
});
test('restoration reconstructs usable places, assigned captain and live lifecycle', () => {
  const b = restoreBooking(record());
  assert.equal(b.pickup.address, 'Street A'); assert.equal(b.drop.city, 'Secunderabad');
  assert.notEqual(b.pickup.id, b.drop.id); assert.equal(b.pickup.kind, 'other');
  assert.equal(b.status, 'at_pickup'); assert.equal(b.captain.id, 'captain-a');
});
test('legacy bookings retain their historical fare without fabricated breakdowns or savings', () => {
  const b = restoreBooking(record()); assert.equal(b.agreedPrice, 1777); assert.equal(b.price.estimate, 1777);
  assert.equal(b.priceBreakdownAvailable, false); assert.equal(b.price.savings, 0); assert.equal(b.price.co2SavedKg, 0);
  assert.equal(b.price.distanceKm, 100);
});
test('new bookings use the saved price snapshot', () => {
  const snapshot = { estimate: 1777, base: 200, distanceKm: 100, savings: 123 };
  const b = restoreBooking(record({ priceSnapshot: snapshot }));
  assert.deepEqual(b.price, snapshot); assert.equal(b.priceBreakdownAvailable, true);
});
test('open, accepted legacy, cancelled and delivered statuses restore correctly', () => {
  assert.equal(restoreBooking(record({ status: 'open', tripStatus: null })).status, 'requested');
  assert.equal(restoreBooking(record({ tripStatus: null })).status, 'accepted');
  assert.equal(restoreBooking(record({ status: 'cancelled', tripStatus: 'at_pickup' })).status, 'cancelled');
  assert.equal(restoreBooking(record({ tripStatus: 'delivered' })).status, 'delivered');
});
test('history refresh and direct-link fetch merge without duplicate records', () => {
  const b = restoreBooking(record());
  const result = mergeBookings([b], [b, restoreBooking(record({ id: 'LM-HISTORY-2', createdAt: '2026-10-26T02:00:00Z' }))]);
  assert.deepEqual(result.map(b => b.id), ['LM-HISTORY-2', 'LM-HISTORY-1']);
});
test('a delayed history page cannot undo a newer handover or cancellation', () => {
  const old = restoreBooking(record());
  for (const status of ['picked', 'delivered', 'cancelled']) {
    const current = { ...old, status, updatedAt: '2026-10-26T02:00:00Z' };
    assert.deepEqual(mergeBookings([current], [old]), [current]);
  }
});
test('newer server progress and captain details replace stale data', () => {
  const old = restoreBooking(record({ tripStatus: 'accepted', captain: null }));
  const current = restoreBooking(record({ updatedAt: '2026-10-26T02:00:00Z' }));
  assert.deepEqual(mergeBookings([old], [current]), [current]);
});
test('equal timestamp and missing timestamp records still cannot move a trip backwards', () => {
  const b = restoreBooking(record());
  assert.equal(mergeBookings([{ ...b, status: 'picked' }], [b])[0].status, 'picked');
  assert.equal(mergeBookings([{ ...b, status: 'delivered', updatedAt: undefined }], [{ ...b, updatedAt: undefined }])[0].status, 'delivered');
});
test('zero agreed fares are preserved and empty history stays empty', () => {
  const b = restoreBooking(record({ agreedPrice: 0 })); assert.equal(b.agreedPrice, 0); assert.equal(b.price.estimate, 0);
  assert.deepEqual(mergeBookings([], []), []);
});
