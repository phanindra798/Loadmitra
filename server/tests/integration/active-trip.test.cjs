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
    { role: 'captain', name: 'Captain A', phone: '9000000001' },
    { role: 'captain', name: 'Captain B', phone: '9000000002' },
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
