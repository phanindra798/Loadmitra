const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { Booking } = require('../dist/models/booking.model');
const { User } = require('../dist/models/user.model');
const { ensureActiveTripIndex, isActiveTripConflict, ACTIVE_TRIP_INDEX_NAME } = require('../dist/services/active-trip.service');
const { acceptRequest } = require('../dist/controllers/trips.controller');
let indexCalls, claimCalls;
beforeEach(() => {
  Booking.db.emit('disconnected');
  indexCalls = 0; claimCalls = 0;
  Booking.collection.createIndex = async () => { indexCalls++; return ACTIVE_TRIP_INDEX_NAME; };
  User.findById = async () => ({ name: 'Test captain' });
  Booking.findOneAndUpdate = async () => { claimCalls++; return null; };
});
const req = { auth: { userId: 'captain-a', role: 'captain' }, params: { id: 'LM-TEST-123456' } };
function response() { return { code: 200, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } }; }
test('concurrent requests await the same index build before attempting a claim', async () => {
  let finish;
  Booking.collection.createIndex = () => { indexCalls++; return new Promise(resolve => { finish = resolve; }); };
  const responses = [response(), response()];
  const calls = responses.map(res => acceptRequest(req, res));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(indexCalls, 1); assert.equal(claimCalls, 0);
  finish(ACTIVE_TRIP_INDEX_NAME); await Promise.all(calls);
  assert.equal(claimCalls, 2);
});
test('failed index creation blocks acceptance without changing any booking and permits a retry', async () => {
  Booking.collection.createIndex = async () => { throw Object.assign(new Error('conflicting legacy records'), { code: 11000 }); };
  const res = response(); await acceptRequest(req, res);
  assert.equal(res.code, 503); assert.equal(claimCalls, 0);
  assert.equal(JSON.stringify(res.body).includes('legacy records'), false);
  Booking.collection.createIndex = async () => { indexCalls++; return ACTIVE_TRIP_INDEX_NAME; };
  await ensureActiveTripIndex(); assert.equal(indexCalls, 1);
});
test('disconnect invalidates index readiness so the next connection verifies it again', async () => {
  await ensureActiveTripIndex(); await ensureActiveTripIndex(); assert.equal(indexCalls, 1);
  Booking.db.emit('disconnected'); await ensureActiveTripIndex(); assert.equal(indexCalls, 2);
});
test('duplicate captain assignment returns an actionable 409', async () => {
  Booking.findOneAndUpdate = async () => { throw { code: 11000, keyPattern: { acceptedByCaptainId: 1 } }; };
  const res = response(); await acceptRequest(req, res);
  assert.equal(res.code, 409); assert.equal(res.body.code, 'ACTIVE_TRIP_EXISTS');
});
test('unrelated database failures are not misreported as an active trip conflict', async () => {
  for (const error of [new Error('offline'), { code: 11000, keyPattern: { bookingId: 1 } }]) {
    Booking.findOneAndUpdate = async () => { throw error; };
    await assert.rejects(acceptRequest(req, response()), value => value === error);
    assert.equal(isActiveTripConflict(error), false);
  }
  assert.equal(isActiveTripConflict(null), false);
});
test('deleted accounts cannot trigger index creation or claim loads', async () => {
  User.findById = async () => null;
  const res = response(); await acceptRequest(req, res);
  assert.equal(res.code, 401); assert.equal(indexCalls, 0); assert.equal(claimCalls, 0);
});
