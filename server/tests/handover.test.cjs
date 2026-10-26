const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { Booking, bookingToTrip, bookingToRequest } = require('../dist/models/booking.model');
const { issueHandoverOtp, getBooking, cancelBooking } = require('../dist/controllers/bookings.controller');
const { updateTripStatus } = require('../dist/controllers/trips.controller');
const { createApp } = require('../dist/app');
const { signToken } = require('../dist/middleware/auth');

let row, beforeConsume;
const get = (path) => path.split('.').reduce((value, part) => value?.[part], row);
function matches(query) {
  return row && Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some(matches);
    const value = get(key);
    if (expected instanceof Date) return value instanceof Date && +value === +expected;
    if (expected && typeof expected === 'object') {
      return Object.entries(expected).every(([op, limit]) => {
        if (op === '$exists') return (value !== undefined) === limit;
        if (op === '$in') return limit.includes(value);
        if (op === '$gt') return value > limit;
        if (op === '$lt') return value < limit;
        if (op === '$lte') return value <= limit;
        throw new Error(`Unsupported query operator ${op}`);
      });
    }
    return value === expected;
  });
}
Booking.findOne = async query => matches(query) ? structuredClone(row) : null;
Booking.findOneAndUpdate = async (query, update) => {
  if (beforeConsume && update.$unset?.handoverOtp && update.$set?.tripStatus !== 'cancelled') {
    const hook = beforeConsume; beforeConsume = null; hook();
  }
  if (!matches(query)) return null;
  Object.assign(row, update.$set);
  if (update.$inc) row.handoverOtp.attempts += update.$inc['handoverOtp.attempts'];
  for (const field of Object.keys(update.$unset || {})) delete row[field];
  return structuredClone(row);
};
const request = (userId, body = {}) => ({
  auth: { userId, role: userId.startsWith('captain') ? 'captain' : 'shipper' },
  params: { id: row?.bookingId || 'LM-HANDOVER-123456' }, body,
});
function response() {
  return { code: 200, headers: {}, status(n) { this.code = n; return this; },
    setHeader(k, v) { this.headers[k] = v; }, json(v) { this.body = v; return this; } };
}
async function issue(user = 'owner') {
  const res = response(); await issueHandoverOtp(request(user), res); return res;
}
async function advance(status, otp, user = 'captain-a') {
  const res = response(); await updateTripStatus(request(user, { status, otp }), res); return res;
}
const wrong = code => code === '123456' ? '654321' : '123456';
beforeEach(() => {
  beforeConsume = null;
  row = { bookingId: 'LM-HANDOVER-123456', shipperId: 'owner', status: 'accepted',
    acceptedByCaptainId: 'captain-a', tripStatus: 'at_pickup', mode: 'full',
    pickup: { label: 'A' }, drop: { label: 'B' }, distanceKm: 100, truckTypeId: 'ace',
    truckTypeName: 'Tata Ace', loadWeightKg: 500, agreedPrice: 2050 };
});

test('owner gets a six-digit expiring code; only a hash is persisted and response cannot be cached', async () => {
  const res = await issue();
  assert.equal(res.code, 200); assert.match(res.body.data.code, /^\d{6}$/);
  assert.equal(res.body.data.stage, 'picked'); assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.match(row.handoverOtp.codeHash, /^[a-f0-9]{64}$/); assert.equal(row.handoverOtp.code, undefined);
  assert.equal(row.handoverOtp.attempts, 0);
  assert.equal(+row.handoverOtp.expiresAt - +row.handoverOtp.issuedAt, 600000);
  assert.equal(new Booking(row).validateSync(), undefined);
});
test('another shipper cannot generate a handover code', async () => {
  assert.equal((await issue('intruder')).code, 404); assert.equal(row.handoverOtp, undefined);
});
test('codes cannot be issued before arrival, after completion, or for cancelled bookings', async () => {
  for (const status of ['accepted', 'enroute_pickup', 'picked', 'delivered', 'cancelled']) {
    row.tripStatus = status; assert.equal((await issue()).code, 409);
  }
  row.tripStatus = 'at_pickup'; row.status = 'cancelled'; assert.equal((await issue()).code, 409);
});
test('arbitrary and legacy four-digit codes cannot confirm pickup', async () => {
  assert.equal((await advance('picked', '1234')).code, 400);
  assert.equal((await advance('picked')).code, 400);
  assert.equal((await advance('picked', '123456')).code, 409);
  const code = (await issue()).body.data.code;
  assert.equal((await advance('picked', wrong(code))).code, 400);
  assert.equal(row.tripStatus, 'at_pickup'); assert.equal(row.handoverOtp.attempts, 1);
});
test('correct pickup code is consumed and cannot be replayed', async () => {
  const code = (await issue()).body.data.code;
  assert.equal((await advance('picked', code)).code, 200);
  assert.equal(row.tripStatus, 'picked'); assert.equal(row.handoverOtp, undefined);
  assert.equal((await advance('picked', code)).code, 409);
});
test('only assigned captain can verify; foreign attempts do not consume the budget', async () => {
  const code = (await issue()).body.data.code;
  assert.equal((await advance('picked', code, 'captain-b')).code, 404);
  assert.equal(row.handoverOtp.attempts, 0);
});
test('expired code is rejected without advancing the trip', async () => {
  const code = (await issue()).body.data.code; row.handoverOtp.expiresAt = new Date(Date.now() - 1);
  assert.equal((await advance('picked', code)).code, 409); assert.equal(row.tripStatus, 'at_pickup');
});
test('five incorrect attempts lock even a subsequent correct code', async () => {
  const code = (await issue()).body.data.code;
  for (let i = 0; i < 5; i++) assert.equal((await advance('picked', wrong(code))).code, 400);
  assert.equal((await advance('picked', code)).code, 409);
  assert.equal(row.handoverOtp.attempts, 5); assert.equal(row.tripStatus, 'at_pickup');
});
test('correct code on the fifth attempt succeeds', async () => {
  const code = (await issue()).body.data.code;
  for (let i = 0; i < 4; i++) await advance('picked', wrong(code));
  assert.equal((await advance('picked', code)).code, 200);
});
test('concurrent verification permits only one successful handover', async () => {
  const code = (await issue()).body.data.code;
  const results = await Promise.all([advance('picked', code), advance('picked', code)]);
  assert.deepEqual(results.map(r => r.code).sort(), [200, 409]); assert.equal(row.handoverOtp, undefined);
});
test('parallel incorrect attempts cannot exceed the persisted attempt limit', async () => {
  const code = (await issue()).body.data.code;
  const results = await Promise.all(Array.from({ length: 12 }, () => advance('picked', wrong(code))));
  assert.equal(results.filter(r => r.code === 400).length, 5);
  assert.equal(row.handoverOtp.attempts, 5); assert.equal(row.tripStatus, 'at_pickup');
});
test('concurrent issuance has one winner; owner can replace a locked code after cooldown', async () => {
  const results = await Promise.all([issue(), issue()]);
  assert.deepEqual(results.map(r => r.code).sort(), [200, 409]);
  row.handoverOtp.attempts = 5; row.handoverOtp.issuedAt = new Date(Date.now() - 31000);
  const fresh = await issue(); assert.equal(fresh.code, 200); assert.equal(row.handoverOtp.attempts, 0);
  assert.equal((await advance('picked', fresh.body.data.code)).code, 200);
});
test('challenge replacement or expiry during verification prevents stale consumption', async () => {
  let code = (await issue()).body.data.code;
  beforeConsume = () => { row.handoverOtp.issuedAt = new Date(+row.handoverOtp.issuedAt + 1); };
  assert.equal((await advance('picked', code)).code, 409); assert.equal(row.tripStatus, 'at_pickup');
  row.handoverOtp.issuedAt = new Date(Date.now() - 31000); code = (await issue()).body.data.code;
  beforeConsume = () => { row.handoverOtp.expiresAt = new Date(Date.now() - 1); };
  assert.equal((await advance('picked', code)).code, 409); assert.equal(row.tripStatus, 'at_pickup');
});
test('pickup code cannot authorize delivery; delivery needs a fresh stage-specific challenge', async () => {
  const pickup = (await issue()).body.data.code;
  await advance('picked', pickup); await advance('enroute_drop');
  assert.equal((await advance('delivered', pickup)).code, 409);
  const delivery = await issue(); assert.equal(delivery.body.data.stage, 'delivered');
  assert.equal((await advance('delivered', delivery.body.data.code)).code, 200);
  assert.equal(row.tripStatus, 'delivered'); assert.equal(row.handoverOtp, undefined);
});
test('stored challenge cannot be transferred to another booking or stage', async () => {
  const code = (await issue()).body.data.code;
  row.bookingId = 'LM-ANOTHER-123456';
  assert.equal((await advance('picked', code)).code, 400);
  row.bookingId = 'LM-HANDOVER-123456'; row.tripStatus = 'enroute_drop'; row.handoverOtp.stage = 'delivered';
  assert.equal((await advance('delivered', code)).code, 400);
});
test('cancellation invalidates a code and booking/captain responses never expose challenges', async () => {
  await issue(); const res = response(); await getBooking(request('owner'), res);
  for (const data of [res.body.data, bookingToTrip(row, row.tripStatus), bookingToRequest(row)]) {
    assert.equal(data.handoverOtp, undefined); assert.equal(data.codeHash, undefined);
  }
  await cancelBooking(request('owner'), response());
  assert.equal(row.status, 'cancelled'); assert.equal(row.handoverOtp, undefined);
});
test('HTTP handover route enforces auth and ownership; valid owner/captain complete pickup', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = (userId, role) => ({ 'Content-Type': 'application/json',
    Authorization: 'Bearer ' + signToken({ userId, role }) });
  const url = `${base}/api/bookings/${row.bookingId}/handover-otp`;
  try {
    let r = await fetch(url, { method: 'POST' }); assert.equal(r.status, 401); await r.text();
    r = await fetch(url, { method: 'POST', headers: headers('captain-a', 'captain') });
    assert.equal(r.status, 403); await r.text();
    r = await fetch(url, { method: 'POST', headers: headers('intruder', 'shipper') });
    assert.equal(r.status, 404); await r.text();
    r = await fetch(url, { method: 'POST', headers: headers('owner', 'shipper') });
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
    const { data } = await r.json();
    r = await fetch(`${base}/api/captain/trips/${row.bookingId}/status`, {
      method: 'POST', headers: headers('captain-a', 'captain'), body: JSON.stringify({ status: 'picked', otp: data.code }),
    });
    assert.equal(r.status, 200); assert.equal((await r.json()).data.status, 'picked');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
