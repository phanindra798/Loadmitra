const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { Types } = require('mongoose');
const { Booking } = require('../dist/models/booking.model');
const { listBookings, getBooking } = require('../dist/controllers/bookings.controller');
const { shipperBookingView } = require('../dist/services/booking-view.service');
const { createApp } = require('../dist/app');
const { signToken } = require('../dist/middleware/auth');

const id = n => new Types.ObjectId(n.toString(16).padStart(24, '0'));
function booking(n, owner = 'owner') {
  return { _id: id(n), bookingId: `LM-HISTORY-${n}`, shipperId: owner, mode: 'full',
    pickup: { label: 'Warehouse', address: 'Pickup address', city: 'Hyderabad' },
    drop: { label: 'Shop', address: 'Drop address', city: 'Secunderabad' },
    truckTypeId: 'ace', truckTypeName: 'Tata Ace', loadWeightKg: 500,
    goodsType: 'Furniture', distanceKm: 100, agreedPrice: 1777,
    status: 'accepted', tripStatus: 'at_pickup',
    createdAt: new Date('2026-10-26T00:00:00Z'), updatedAt: new Date('2026-10-26T01:00:00Z'),
    createdLabel: 'Spoofed display date', requestFingerprint: 'private-fingerprint',
    handoverOtp: { codeHash: 'private-hash', attempts: 1 },
    captain: { id: 'captain-a', name: 'Captain', phoneMasked: '***1234', rating: 0, trips: 0,
      vehicleNumber: 'Not registered', truckTypeId: '', etaMins: 0, hue: 211, badges: [], privateField: 'secret' },
  };
}
let rows, lastFilter;
beforeEach(() => { rows = [booking(1), booking(2, 'other'), booking(3), booking(4, undefined)]; rows[3].shipperId = undefined; lastFilter = null; });
Booking.find = query => {
  lastFilter = query;
  return { sort(order) {
    assert.deepEqual(order, { _id: -1 });
    return { async limit(limit) {
      assert.ok(limit >= 2 && limit <= 101);
      return rows.filter(b => b.shipperId === query.shipperId && (!query._id || b._id.toString() < query._id.$lt.toString()))
        .sort((a, b) => b._id.toString().localeCompare(a._id.toString())).slice(0, limit);
    } };
  } };
};
Booking.findOne = async query => rows.find(b => b.bookingId === query.bookingId && b.shipperId === query.shipperId) ?? null;
function res() { return { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; },
  status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } }; }
const req = (query = {}, userId = 'owner', bookingId = 'LM-HISTORY-1') => ({ query, auth: { userId, role: 'shipper' }, params: { id: bookingId } });

test('history returns only owned records, newest first, without demo/ownerless bookings', async () => {
  const r = res(); await listBookings(req(), r);
  assert.equal(r.code, 200); assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.deepEqual(r.body.data.map(b => b.id), ['LM-HISTORY-3', 'LM-HISTORY-1']);
  assert.equal(r.body.nextCursor, null); assert.equal(lastFilter.shipperId, 'owner');
});
test('cursor pages are bounded, stable across new insertions, and have no duplicates', async () => {
  const first = res(); await listBookings(req({ limit: '1' }), first);
  assert.equal(first.body.nextCursor, id(3).toString()); rows.push(booking(10));
  const second = res(); await listBookings(req({ limit: '1', before: first.body.nextCursor }), second);
  assert.deepEqual(second.body.data.map(b => b.id), ['LM-HISTORY-1']); assert.equal(second.body.nextCursor, null);
});
test('cursor and query fields cannot select another owner', async () => {
  const r = res(); await listBookings(req({ before: id(10).toString(), shipperId: 'other' }), r);
  assert.deepEqual(r.body.data.map(b => b.id), ['LM-HISTORY-3', 'LM-HISTORY-1']);
});
test('malformed cursors and unbounded page sizes are rejected before querying', async () => {
  for (const query of [{ before: 'invalid' }, { before: { $gt: '' } }, { limit: 0 }, { limit: 101 }, { limit: 'NaN' }, { limit: 1.5 }]) {
    const r = res(); await listBookings(req(query), r); assert.equal(r.code, 400);
  }
  assert.equal(lastFilter, null);
});
test('full detail restores route, load, fare, status and captain independent of pagination', async () => {
  const r = res(); await getBooking(req(), r);
  assert.equal(r.code, 200); assert.equal(r.headers['Cache-Control'], 'no-store');
  const b = r.body.data;
  assert.equal(b.pickup.address, 'Pickup address'); assert.equal(b.drop.city, 'Secunderabad');
  assert.equal(b.loadWeightKg, 500); assert.equal(b.goodsType, 'Furniture');
  assert.equal(b.agreedPrice, 1777); assert.equal(b.tripStatus, 'at_pickup');
  assert.equal(b.captain.id, 'captain-a'); assert.equal(b.createdAt, '2026-10-26T00:00:00.000Z');
  assert.notEqual(b.createdLabel, 'Spoofed display date');
});
test('detail returns 404 for another owner, ownerless legacy records and unknown IDs', async () => {
  for (const bookingId of ['LM-HISTORY-2', 'LM-HISTORY-4', 'LM-UNKNOWN-1']) {
    const r = res(); await getBooking(req({}, 'owner', bookingId), r); assert.equal(r.code, 404);
  }
});
test('public history and detail views exclude challenge hashes and private model fields', async () => {
  const r = res(); await listBookings(req(), r);
  for (const b of [...r.body.data, shipperBookingView(rows[0])]) {
    for (const field of ['shipperId', 'requestFingerprint', 'handoverOtp', '_id']) assert.equal(b[field], undefined);
    assert.equal(b.captain.privateField, undefined);
    assert.ok(!JSON.stringify(b).includes('private-hash'));
  }
});
test('historical fare is not recalculated when a truck is retired or a snapshot is absent', () => {
  const old = booking(1); old.truckTypeId = 'retired-truck';
  const b = shipperBookingView(old); assert.equal(b.agreedPrice, 1777); assert.equal(b.priceSnapshot, null);
});
test('recorded price snapshot survives reads without repricing', () => {
  const old = booking(1); old.priceSnapshot = { estimate: 1777, ratePerKm: 12, base: 200 };
  assert.deepEqual(shipperBookingView(old).priceSnapshot, old.priceSnapshot);
});
test('new account receives an empty history, not samples', async () => {
  const r = res(); await listBookings(req({}, 'new-owner'), r); assert.deepEqual(r.body, { data: [], nextCursor: null });
});
test('history HTTP route enforces shipper authentication and propagates database errors', async () => {
  const server = createApp().listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/bookings`;
  const headers = role => ({ Authorization: 'Bearer ' + signToken({ userId: 'owner', role }) });
  const originalFind = Booking.find;
  try {
    let r = await fetch(url); assert.equal(r.status, 401); await r.text();
    r = await fetch(url, { headers: headers('captain') }); assert.equal(r.status, 403); await r.text();
    r = await fetch(url, { headers: headers('shipper') }); assert.equal(r.status, 200);
    assert.equal((await r.json()).data.length, 2);
    Booking.find = () => { throw new Error('synthetic history database failure'); };
    r = await fetch(url, { headers: headers('shipper') }); assert.equal(r.status, 500); await r.text();
  } finally { Booking.find = originalFind; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
