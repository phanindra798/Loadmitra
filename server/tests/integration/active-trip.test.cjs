// Real MongoDB tests. Starts its own loopback-only mongod with temporary data;
// never uses the developer's .env database, existing service or Atlas cluster.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const mongoose = require('mongoose');
const { Booking } = require('../../dist/models/booking.model');
const { User } = require('../../dist/models/user.model');
const { ensureActiveTripIndex, ACTIVE_TRIP_INDEX_NAME } = require('../../dist/services/active-trip.service');
const { createApp } = require('../../dist/app');
const { signToken } = require('../../dist/middleware/auth');
let child, directory, server, base, captainA, captainB, owner;
async function freePort() {
  const listener = net.createServer(); listener.listen(0, '127.0.0.1');
  await once(listener, 'listening'); const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve)); return port;
}
before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'loadmitra-mongo-test-'));
  const port = await freePort();
  let spawnError;
  child = spawn(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', directory, '--port', String(port),
    '--bind_ip', '127.0.0.1', '--logpath', join(directory, 'mongod.log'), '--quiet',
    '--setParameter', 'diagnosticDataCollectionEnabled=false'], { stdio: 'ignore' });
  child.on('error', error => { spawnError = error; });
  const deadline = Date.now() + 25000;
  while (true) {
    if (spawnError) throw new Error('Set MONGOD_BINARY to an installed mongod executable.', { cause: spawnError });
    if (child.exitCode !== null) throw new Error('Test mongod exited: ' + readFileSync(join(directory, 'mongod.log'), 'utf8').slice(-3000));
    try {
      await mongoose.connect(`mongodb://127.0.0.1:${port}/loadmitra_isolated_test`, { serverSelectionTimeoutMS: 500, autoIndex: false });
      break;
    } catch (error) { if (Date.now() >= deadline) throw error; await delay(100); }
  }
  await Booking.createIndexes(); await User.createIndexes();
  await ensureActiveTripIndex();
  server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
}, { timeout: 35000 });
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect();
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'exit'); child.kill(); await closed;
  }
  if (directory) rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
beforeEach(async () => {
  await Booking.deleteMany({}); await User.deleteMany({});
  [captainA, captainB, owner] = await User.create([
    { role: 'captain', name: 'Captain A', phone: '9000000001', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'captain', name: 'Captain B', phone: '9000000002', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'shipper', name: 'Shipper', phone: '9000000003' },
  ]);
});
async function post(path, user, body = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = 'Bearer ' + signToken({ userId: String(user._id), role: user.role });
  const response = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function load(id, extra = {}) {
  return Booking.create({ bookingId: 'LM-INTEGRATION-' + id, shipperId: String(owner._id),
    mode: 'full', pickup: { label: 'Pickup' }, drop: { label: 'Drop' }, distanceKm: 100,
    truckTypeId: 'ace', truckTypeName: 'Tata Ace', loadWeightKg: 500, agreedPrice: 2050, ...extra });
}
const accept = (booking, captain = captainA, body) => post(`/api/captain/requests/${booking.bookingId}/accept`, captain, body);
const advance = (booking, status, otp) => post(`/api/captain/trips/${booking.bookingId}/status`, captainA, { status, otp });
async function handover(booking, status) {
  const issued = await post(`/api/bookings/${booking.bookingId}/handover-otp`, owner);
  assert.equal(issued.status, 200); return advance(booking, status, issued.body.data.code);
}

test('simultaneous claims of different loads by one captain produce exactly one winner', async () => {
  const loads = await Promise.all(Array.from({ length: 8 }, (_, i) => load('race-' + i)));
  const results = await Promise.all(loads.map(booking => accept(booking)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409 && r.body.code === 'ACTIVE_TRIP_EXISTS').length, 7);
  assert.equal(await Booking.countDocuments({ status: 'open' }), 7);
  assert.equal(await Booking.countDocuments({ acceptedByCaptainId: String(captainA._id) }), 1);
});
test('two captains racing for the same load produce one winner', async () => {
  const booking = await load('same');
  const results = await Promise.all([accept(booking), accept(booking, captainB)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
});
test('different captains can accept different loads concurrently and forged identity is ignored', async () => {
  const a = await load('a'); const b = await load('b');
  const results = await Promise.all([accept(a, captainA, { captain: { id: String(captainB._id) } }), accept(b, captainB)]);
  assert.deepEqual(results.map(r => r.status), [201, 201]);
  assert.equal((await Booking.findById(a._id)).acceptedByCaptainId, String(captainA._id));
});
test('every active lifecycle stage blocks a second load until verified delivery', async () => {
  const a = await load('lifecycle'); const b = await load('waiting');
  assert.equal((await accept(a)).status, 201);
  assert.equal((await accept(b)).status, 409);
  for (const stage of ['enroute_pickup', 'at_pickup']) {
    assert.equal((await advance(a, stage)).status, 200); assert.equal((await accept(b)).status, 409);
  }
  assert.equal((await handover(a, 'picked')).status, 200); assert.equal((await accept(b)).status, 409);
  assert.equal((await advance(a, 'enroute_drop')).status, 200); assert.equal((await accept(b)).status, 409);
  const issued = await post(`/api/bookings/${a.bookingId}/handover-otp`, owner);
  assert.equal(issued.status, 200);
  const code = issued.body.data.code;
  assert.equal((await advance(a, 'delivered', code === '123456' ? '654321' : '123456')).status, 400);
  assert.equal((await accept(b)).status, 409);
  assert.equal((await advance(a, 'delivered', code)).status, 200);
  assert.equal((await accept(b)).status, 201);
  assert.equal((await Booking.findById(a._id)).acceptedByCaptainId, String(captainA._id));
});
for (const actor of ['captain', 'shipper']) {
  test(actor + ' cancellation releases the slot while preserving historical captain ownership', async () => {
    const a = await load('cancel'); const b = await load('next');
    assert.equal((await accept(a)).status, 201);
    const cancelled = actor === 'captain' ? await advance(a, 'cancelled') : await post(`/api/bookings/${a.bookingId}/cancel`, owner);
    assert.equal(cancelled.status, 200); assert.equal((await accept(b)).status, 201);
    assert.equal((await Booking.findById(a._id)).acceptedByCaptainId, String(captainA._id));
  });
}
test('unauthorized cancellation cannot free a captain slot', async () => {
  const a = await load('unauthorized'); const b = await load('pending'); await accept(a);
  assert.equal((await post(`/api/captain/trips/${a.bookingId}/status`, captainB, { status: 'cancelled' })).status, 404);
  assert.equal((await accept(b)).status, 409);
});
test('legacy accepted trips with missing or null lifecycle still occupy a slot', async () => {
  for (const state of [undefined, null]) {
    await Booking.deleteMany({});
    await load('legacy', { status: 'accepted', acceptedByCaptainId: String(captainA._id), tripStatus: state });
    const next = await load('next'); assert.equal((await accept(next)).status, 409);
  }
});
test('shipper can cancel legacy accepted trips with missing or null lifecycle and free the slot', async () => {
  for (const state of [undefined, null]) {
    await Booking.deleteMany({});
    const legacy = await load('legacy-cancel', { status: 'accepted', acceptedByCaptainId: String(captainA._id), tripStatus: state });
    assert.equal((await post(`/api/bookings/${legacy.bookingId}/cancel`, owner)).status, 200);
    const next = await load('next'); assert.equal((await accept(next)).status, 201);
  }
});
test('terminal history and unassigned accepted legacy records do not occupy a slot', async () => {
  for (const tripStatus of ['delivered', 'cancelled']) {
    await load(tripStatus, { status: 'accepted', acceptedByCaptainId: String(captainA._id), tripStatus });
  }
  await load('unassigned', { status: 'accepted' }); await load('unassigned-two', { status: 'accepted' });
  assert.equal((await accept(await load('new'))).status, 201);
});
test('a direct database write cannot bypass the active captain constraint', async () => {
  await accept(await load('first'));
  await assert.rejects(load('bypass', { status: 'accepted', tripStatus: 'picked', acceptedByCaptainId: String(captainA._id) }), error => error.code === 11000);
});
test('acceptance rejects anonymous, wrong-role and deleted accounts without claiming the load', async () => {
  const a = await load('auth');
  assert.equal((await accept(a, null)).status, 401);
  assert.equal((await accept(a, owner)).status, 403);
  await User.deleteOne({ _id: captainA._id }); assert.equal((await accept(a)).status, 401);
  assert.equal((await Booking.findById(a._id)).status, 'open');
});
test('conflicting preexisting records block index installation and acceptance until resolved', async () => {
  // Only this disposable database is modified. Production data is never repaired automatically.
  await Booking.collection.dropIndex(ACTIVE_TRIP_INDEX_NAME); Booking.db.emit('disconnected');
  try {
    const extra = { status: 'accepted', acceptedByCaptainId: String(captainA._id), tripStatus: 'accepted' };
    await load('legacy-one', extra); const duplicate = await load('legacy-two', extra);
    const waiting = await load('waiting');
    await assert.rejects(ensureActiveTripIndex(), error => error.code === 11000);
    assert.equal((await accept(waiting)).status, 503);
    assert.equal((await Booking.findById(waiting._id)).status, 'open');
    assert.equal(await Booking.countDocuments({ status: 'accepted' }), 2);
    await Booking.updateOne({ _id: duplicate._id }, { $set: { status: 'cancelled', tripStatus: 'cancelled' } });
    await ensureActiveTripIndex(); assert.equal((await accept(waiting)).status, 409);
    assert.equal((await accept(waiting, captainB)).status, 201);
  } finally {
    await Booking.deleteMany({}); Booking.db.emit('disconnected'); await ensureActiveTripIndex();
  }
});


async function get(path, user = captainA) {
  const headers = user ? { Authorization: 'Bearer ' + signToken({ userId: String(user._id), role: user.role }) } : {};
  const response = await fetch(base + path, { headers });
  return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
}
test('direct trip recovery is owner-scoped, uncached and excludes private fields', async () => {
  const booking = await load('recovery', { requestFingerprint: 'private-fingerprint' });
  await accept(booking);
  const result = await get('/api/captain/trips/' + booking.bookingId);
  assert.equal(result.status, 200); assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.pickup.label, 'Pickup'); assert.equal(result.body.data.status, 'accepted');
  assert.ok(result.body.data.createdAt); assert.ok(result.body.data.updatedAt);
  for (const key of ['shipperId', 'acceptedByCaptainId', 'requestFingerprint', 'handoverOtp', '_id']) assert.equal(key in result.body.data, false);
  assert.equal((await get('/api/captain/trips/' + booking.bookingId, captainB)).status, 404);
  assert.equal((await get('/api/captain/trips/' + booking.bookingId, owner)).status, 403);
  assert.equal((await get('/api/captain/trips/' + booking.bookingId, null)).status, 401);
  assert.equal((await get('/api/captain/trips/LM-INTEGRATION-missing')).status, 404);
});
test('the active trip is recovered even outside the most recent 100 bookings', async () => {
  const old = await load('old-active'); await accept(old);
  await Booking.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date('2020-01-01') } });
  const template = old.toObject(); delete template._id; delete template.__v;
  await Booking.insertMany(Array.from({ length: 101 }, (_, i) => ({ ...template,
    bookingId: 'LM-INTEGRATION-history-' + i, status: 'accepted', tripStatus: 'delivered',
    acceptedByCaptainId: String(captainA._id), createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-02'),
  })));
  const result = await get('/api/captain/trips');
  assert.equal(result.cache, 'no-store'); assert.equal(result.body.data.length, 100);
  assert.equal(result.body.data.some(trip => trip.id === old.bookingId), false);
  assert.equal(result.body.activeTrip.id, old.bookingId);
  assert.equal((await get('/api/captain/trips/' + old.bookingId)).status, 200);
  const other = await get('/api/captain/trips', captainB);
  assert.deepEqual(other.body.data, []); assert.equal(other.body.activeTrip, null);
});
test('shipper cancellation appears in subsequent captain reads and releases the active view', async () => {
  const booking = await load('cancel-recovery'); await accept(booking);
  assert.equal((await post('/api/bookings/' + booking.bookingId + '/cancel', owner)).status, 200);
  const list = await get('/api/captain/trips');
  assert.equal(list.body.activeTrip, null); assert.equal(list.body.data[0].status, 'cancelled');
  const detail = await get('/api/captain/trips/' + booking.bookingId);
  assert.equal(detail.body.data.status, 'cancelled');
});
test('status mutations return the full saved trip for immediate cache replacement', async () => {
  const booking = await load('updated-record'); await accept(booking);
  const result = await advance(booking, 'enroute_pickup');
  assert.equal(result.status, 200); assert.equal(result.body.data.status, 'enroute_pickup');
  assert.equal(result.body.data.id, booking.bookingId); assert.equal(result.body.data.pickup.label, 'Pickup');
  assert.ok(result.body.data.payout.net > 0); assert.ok(result.body.data.updatedAt);
});


const { getEarningsSummary } = require('../../dist/services/earnings-summary.service');
const { captainPayout } = require('../../dist/services/earnings.service');
const fixedNow = new Date('2026-11-02T12:00:00Z');
async function earned(id, completedAt, extra = {}) {
  return load(id, { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id),
    completedAt: new Date(completedAt), payoutSnapshot: captainPayout(2050, 'full', 100), ...extra });
}
test('earnings use only the assigned captain, completed status and saved calendar date', async () => {
  await earned('today', '2026-11-01T18:30:00Z');
  await earned('month-not-week', '2026-10-31T18:30:00Z');
  await earned('old-month', '2026-10-31T18:29:59Z');
  await earned('foreign', '2026-11-02T00:00:00Z', { acceptedByCaptainId: String(captainB._id) });
  await earned('cancelled', '2026-11-02T00:00:00Z', { status: 'cancelled' });
  await load('unfinished', { status: 'accepted', tripStatus: 'picked', acceptedByCaptainId: String(captainA._id) });
  const summary = await getEarningsSummary(String(captainA._id), fixedNow);
  assert.equal(summary.today, 1742); assert.equal(summary.week, 1742); assert.equal(summary.month, 3484);
  assert.equal(summary.tripsToday, 1); assert.equal(summary.weekly[0].net, 1742); assert.equal(summary.ledger.length, 3);
  assert.equal(summary.acceptanceRate, null); assert.equal(summary.onlineHoursToday, null);
  assert.equal(summary.timeZone, 'Asia/Kolkata');
});
test('earnings include the earlier-month part of a calendar week and exclude future deliveries', async () => {
  await earned('previous-month', '2026-10-30T00:00:00Z');
  await earned('new-month', '2026-10-31T18:30:00Z');
  await earned('future', '2026-11-02T00:00:00Z');
  const summary = await getEarningsSummary(String(captainA._id), new Date('2026-11-01T12:00:00Z'));
  assert.equal(summary.today, 1742); assert.equal(summary.week, 3484); assert.equal(summary.month, 1742);
});
test('earnings sum every qualifying delivery while the recent ledger remains bounded', async () => {
  const template = (await earned('template', '2026-11-02T00:00:00Z')).toObject(); delete template._id; delete template.__v;
  await Booking.insertMany(Array.from({ length: 124 }, (_, i) => ({ ...template, bookingId: 'LM-EARNINGS-' + i })));
  const summary = await getEarningsSummary(String(captainA._id), fixedNow);
  assert.equal(summary.today, 125 * 1742); assert.equal(summary.tripsToday, 125); assert.equal(summary.ledger.length, 20);
});
test('legacy completed records remain visible but never acquire invented dates or period earnings', async () => {
  await load('undated', { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id) });
  const before = await Booking.findOne({ bookingId: 'LM-INTEGRATION-undated' });
  const summary = await getEarningsSummary(String(captainA._id), fixedNow);
  assert.equal(summary.today, 0); assert.equal(summary.week, 0); assert.equal(summary.month, 0);
  assert.equal(summary.unknownCompletionTrips, 1); assert.equal(summary.ledger[0].legacyEstimate, true);
  assert.equal(summary.ledger[0].dateLabel, 'Completion date not recorded'); assert.equal(summary.ledger[0].net, 1742);
  const after = await Booking.findById(before._id); assert.equal(after.completedAt, undefined); assert.equal(after.payoutSnapshot, undefined);
});
test('saved payout and completion date survive unrelated record updates', async () => {
  const record = await earned('frozen', '2026-11-02T00:00:00Z', { mode: 'return', payoutSnapshot: { fare: 1000, commissionPct: .1, commission: 100, incentive: 50, net: 950, perKm: 9.5 } });
  await Booking.updateOne({ _id: record._id }, { $set: { agreedPrice: 99999 } });
  const summary = await getEarningsSummary(String(captainA._id), fixedNow);
  assert.equal(summary.today, 950); assert.equal(summary.incentiveThisWeek, 50); assert.equal(summary.ledger[0].net, 950);
  assert.equal((await get('/api/captain/trips/' + record.bookingId)).body.data.payout.net, 950);
});
test('verified delivery records earnings exactly once and a failed code records nothing', async () => {
  const record = await load('earned-once'); await accept(record);
  await advance(record, 'enroute_pickup'); await advance(record, 'at_pickup'); await handover(record, 'picked'); await advance(record, 'enroute_drop');
  const code = (await post('/api/bookings/' + record.bookingId + '/handover-otp', owner)).body.data.code;
  assert.equal((await advance(record, 'delivered', code === '123456' ? '654321' : '123456')).status, 400);
  assert.equal((await Booking.findById(record._id)).completedAt, undefined);
  assert.equal((await get('/api/captain/earnings')).body.data.today, 0);
  assert.equal((await advance(record, 'delivered', code)).status, 200);
  const completed = await Booking.findById(record._id);
  assert.ok(completed.completedAt instanceof Date); assert.equal(completed.payoutSnapshot.net, 1742);
  assert.equal((await advance(record, 'delivered', code)).status, 409);
  const summary = (await get('/api/captain/earnings')).body.data;
  assert.equal(summary.today, 1742); assert.equal(summary.tripsToday, 1);
  assert.equal(+(await Booking.findById(record._id)).completedAt, +completed.completedAt);
});
test('earnings HTTP reads enforce roles, disable caching and start empty for a new captain', async () => {
  assert.equal((await get('/api/captain/earnings', null)).status, 401);
  assert.equal((await get('/api/captain/earnings', owner)).status, 403);
  const response = await get('/api/captain/earnings', captainB);
  assert.equal(response.status, 200); assert.equal(response.cache, 'no-store'); assert.equal(response.body.data.today, 0);
  assert.deepEqual(response.body.data.ledger, []); assert.equal(response.body.data.weekly.length, 7);
});
test('earnings database failure returns a controlled error rather than fake zero totals', async () => {
  const aggregate = Booking.aggregate;
  Booking.aggregate = () => { throw new Error('isolated database outage'); };
  try { const response = await get('/api/captain/earnings'); assert.equal(response.status, 500); assert.deepEqual(response.body, { error: 'Internal server error' }); }
  finally { Booking.aggregate = aggregate; }
});

async function vehicle(user, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = 'Bearer ' + signToken({ userId: String(user._id), role: user.role });
  const response = await fetch(base + '/api/captain/vehicle', { method: 'PATCH', headers, body: JSON.stringify(body) });
  return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
}
const registration = { vehicleNumber: ' ts-09 ab 9876 ', truckTypeId: 'pickup8', city: ' Hyderabad ' };
test('vehicle registration persists normalized details only for the signed-in captain', async () => {
  const saved = await vehicle(captainA, registration);
  assert.equal(saved.status, 200); assert.equal(saved.cache, 'no-store');
  assert.equal(saved.body.data.vehicleNumber, 'TS09AB9876'); assert.equal(saved.body.data.kycVerified, false);
  assert.equal(saved.body.data.city, 'Hyderabad');
  const profile = await get('/api/captain/me');
  assert.equal(profile.cache, 'no-store'); assert.equal(profile.body.data.id, String(captainA._id));
  assert.equal(profile.body.data.name, 'Captain A'); assert.equal(profile.body.data.phoneMasked, '••••••0001');
  assert.equal(profile.body.data.vehicleNumber, 'TS09AB9876'); assert.equal(profile.body.data.truckTypeId, 'pickup8');
  assert.equal((await User.findById(captainB._id)).vehicle.vehicleNumber, 'TS09AB1234');
  assert.equal(profile.body.data.email, undefined); assert.equal(profile.body.data.phone, undefined);
});
test('vehicle endpoints reject anonymous, shipper and deleted accounts', async () => {
  for (const [user, status] of [[null, 401], [owner, 403]]) {
    assert.equal((await vehicle(user, registration)).status, status);
    assert.equal((await get('/api/captain/me', user)).status, status);
  }
  await User.deleteOne({ _id: captainA._id });
  assert.equal((await vehicle(captainA, registration)).status, 401);
  assert.equal((await get('/api/captain/me')).status, 401);
});
test('invalid registration and forged verification or owner fields never change the profile', async () => {
  const invalid = [
    { ...registration, truckTypeId: 'unknown' }, { ...registration, vehicleNumber: '123456' },
    { ...registration, vehicleNumber: 'ABCDEF' }, { ...registration, vehicleNumber: '<script>' },
    { ...registration, city: ' ' }, { ...registration, city: 'A'.repeat(81) },
    { ...registration, kycVerified: true }, { ...registration, id: String(captainB._id) },
    { ...registration, rating: 5 },
  ];
  for (const payload of invalid) assert.equal((await vehicle(captainA, payload)).status, 400);
  assert.equal((await User.findById(captainA._id)).vehicle.vehicleNumber, 'TS09AB1234');
});
test('unregistered captains see no offers and cannot claim loads', async () => {
  await User.updateOne({ _id: captainA._id }, { $unset: { vehicle: 1 } });
  const booking = await load('no-vehicle');
  const result = await accept(booking); assert.equal(result.status, 409); assert.equal(result.body.code, 'VEHICLE_REQUIRED');
  assert.deepEqual((await get('/api/captain/requests')).body.data, []);
  assert.equal((await Booking.findById(booking._id)).status, 'open');
  assert.equal((await get('/api/captain/me')).body.data.vehicleNumber, 'Not registered');
});
test('offers and atomic acceptance enforce truck type and weight capacity', async () => {
  const compatible = await load('compatible');
  const wrong = await load('wrong', { truckTypeId: 'pickup8', truckTypeName: 'Pickup 8 ft' });
  const overweight = await load('overweight', { loadWeightKg: 751 });
  const invalidWeight = await load('invalid-weight', { loadWeightKg: 0 });
  const offers = await get('/api/captain/requests'); assert.equal(offers.cache, 'no-store');
  assert.deepEqual(offers.body.data.map(b => b.id), [compatible.bookingId]);
  for (const booking of [wrong, overweight, invalidWeight]) assert.equal((await accept(booking)).status, 409);
  assert.equal((await accept(compatible)).status, 201);
});
test('changing a vehicle invalidates stale offers while preserving accepted vehicle snapshots', async () => {
  const old = await load('stale'); const assigned = await load('assigned');
  assert.equal((await accept(assigned)).status, 201);
  const snapshot = (await Booking.findById(assigned._id)).captain.toObject();
  assert.equal(snapshot.vehicleNumber, 'TS09AB1234'); assert.equal(snapshot.truckTypeId, 'ace');
  assert.equal(snapshot.phoneMasked, '••••••0001'); assert.deepEqual(snapshot.badges, []);
  assert.equal((await vehicle(captainA, registration)).status, 200);
  assert.deepEqual((await Booking.findById(assigned._id)).captain.toObject(), snapshot);
  assert.equal((await advance(assigned, 'cancelled')).status, 200);
  assert.equal((await accept(old)).status, 409);
  const next = await load('new-vehicle', { truckTypeId: 'pickup8', loadWeightKg: 1200 });
  assert.equal((await accept(next)).status, 201);
  assert.equal((await Booking.findById(next._id)).captain.vehicleNumber, 'TS09AB9876');
});
test('legacy captains can finish existing trips without registering a vehicle again', async () => {
  const booking = await load('existing'); await accept(booking);
  await User.updateOne({ _id: captainA._id }, { $unset: { vehicle: 1 } });
  assert.equal((await advance(booking, 'enroute_pickup')).status, 200);
  assert.equal((await get('/api/captain/trips/' + booking.bookingId)).status, 200);
});
test('captain profile counts only their completed deliveries and never grants verification', async () => {
  await load('complete-a', { acceptedByCaptainId: String(captainA._id), status: 'accepted', tripStatus: 'delivered' });
  await load('cancelled-a', { acceptedByCaptainId: String(captainA._id), status: 'cancelled', tripStatus: 'cancelled' });
  await load('complete-b', { acceptedByCaptainId: String(captainB._id), status: 'accepted', tripStatus: 'delivered' });
  const result = await get('/api/captain/me');
  assert.equal(result.body.data.trips, 1); assert.equal(result.body.data.rating, 0); assert.equal(result.body.data.kycVerified, false);
});
