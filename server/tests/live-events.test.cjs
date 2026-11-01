const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { RevokedToken } = require('../dist/models/revoked-token.model');
// No database in this suite: track revocations in memory.
const revoked = new Set();
RevokedToken.exists = async ({ jti }) => (revoked.has(jti) ? { _id: jti } : null);
RevokedToken.updateOne = async ({ jti }) => { revoked.add(jti); return { acknowledged: true }; };
const { Booking } = require('../dist/models/booking.model');
const { createApp } = require('../dist/app');
const { signToken } = require('../dist/middleware/auth');
const live = require('../dist/services/live-events.service');

let server, base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => live.closeAllStreams());
after(async () => { live.closeAllStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

const token = (userId, role) => signToken({ userId, role });

/** Opens a stream and collects parsed `data:` events as they arrive. */
async function connect(auth) {
  const controller = new AbortController();
  const res = await fetch(base + '/api/events', { headers: { Authorization: `Bearer ${auth}` }, signal: controller.signal });
  const stream = { res, events: [], raw: '', ended: false, close: () => controller.abort() };
  if (res.ok) {
    (async () => {
      const decoder = new TextDecoder();
      try {
        for await (const chunk of res.body) {
          stream.raw += decoder.decode(chunk, { stream: true });
          const blocks = stream.raw.split('\n\n'); stream.raw = blocks.pop();
          for (const block of blocks) {
            const data = block.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
            if (data) stream.events.push(JSON.parse(data));
          }
        }
      } catch { /* aborted */ }
      stream.ended = true;
    })();
  }
  return stream;
}
async function until(check, label) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('Timed out: ' + label);
}
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

test('requires a valid, unrevoked session', async () => {
  assert.equal((await fetch(base + '/api/events')).status, 401);
  assert.equal((await fetch(base + '/api/events', { headers: { Authorization: 'Bearer nope' } })).status, 401);
  const auth = token('shipper-revoked', 'shipper');
  revoked.add(require('jsonwebtoken').decode(auth).jti);
  assert.equal((await fetch(base + '/api/events', { headers: { Authorization: `Bearer ${auth}` } })).status, 401);
});

test('opens an uncached, unbuffered event stream', async () => {
  const stream = await connect(token('shipper-1', 'shipper'));
  assert.equal(stream.res.status, 200);
  assert.match(stream.res.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(stream.res.headers.get('cache-control'), 'no-store');
  assert.equal(stream.res.headers.get('x-accel-buffering'), 'no');
  await until(() => live.streamCount() === 1, 'stream registered');
  stream.close();
  await until(() => live.streamCount() === 0, 'stream removed on disconnect');
});

test('signals reach only the users and roles a booking concerns', async () => {
  const shipper = await connect(token('shipper-1', 'shipper'));
  const otherShipper = await connect(token('shipper-2', 'shipper'));
  const captain = await connect(token('captain-1', 'captain'));
  const otherCaptain = await connect(token('captain-2', 'captain'));
  await until(() => live.streamCount() === 4, 'four streams');

  live.publishBookingChange({ bookingId: 'LM-LIVE-000001', shipperId: 'shipper-1', acceptedByCaptainId: 'captain-1' });
  await until(() => shipper.events.length === 1 && captain.events.length === 1, 'owner signals');
  assert.deepEqual(shipper.events, [{ type: 'booking', id: 'LM-LIVE-000001' }]);
  assert.deepEqual(captain.events, [{ type: 'trip', id: 'LM-LIVE-000001' }]);

  live.publishBookingChange({ bookingId: 'LM-LIVE-000002', shipperId: 'shipper-1' }, { offers: true });
  await until(() => otherCaptain.events.length === 1 && captain.events.length === 2, 'job board signal');
  assert.deepEqual(otherCaptain.events, [{ type: 'offers' }]);
  await settle();
  assert.deepEqual(otherShipper.events, [], 'another shipper hears nothing');
  // Signals carry ids only, never booking data.
  assert.ok([...shipper.events, ...captain.events].every(event => Object.keys(event).every(key => key === 'type' || key === 'id')));
});

test('cancelling and accepting bookings publish through the API', async () => {
  let row = { bookingId: 'LM-LIVE-000003', shipperId: 'shipper-1', status: 'open',
    pickup: { label: 'Gachibowli', city: 'Hyderabad' }, drop: { label: 'Warangal', city: 'Warangal' } };
  Booking.findOneAndUpdate = async () => ({ ...row, status: 'cancelled', tripStatus: 'cancelled' });
  const shipper = await connect(token('shipper-1', 'shipper'));
  const captain = await connect(token('captain-9', 'captain'));
  await until(() => live.streamCount() === 2, 'streams');
  const res = await fetch(`${base}/api/bookings/${row.bookingId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token('shipper-1', 'shipper')}` } });
  assert.equal(res.status, 200);
  await until(() => shipper.events.length === 1 && captain.events.length === 1, 'cancel signals');
  assert.deepEqual(captain.events, [{ type: 'offers' }], 'an open booking leaves the job board');

  row = { ...row, acceptedByCaptainId: 'captain-9', status: 'accepted' };
  await fetch(`${base}/api/bookings/${row.bookingId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token('shipper-1', 'shipper')}` } });
  await until(() => captain.events.length === 2, 'assigned captain told');
  assert.deepEqual(captain.events[1], { type: 'trip', id: row.bookingId });
});

test('logout ends that session\'s streams but not other sessions', async () => {
  const first = token('shipper-3', 'shipper');
  const a = await connect(first);
  const b = await connect(token('shipper-3', 'shipper'));
  await until(() => live.streamCount() === 2, 'two sessions');
  const res = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${first}` } });
  assert.equal(res.status, 200);
  await until(() => a.ended, 'revoked stream ended');
  assert.equal(live.streamCount(), 1);
  assert.equal(b.ended, false);
});

test('limits concurrent streams per account', async () => {
  const auth = token('captain-many', 'captain');
  const open = [];
  for (let i = 0; i < live.MAX_STREAMS_PER_USER; i++) open.push(await connect(auth));
  assert.ok(open.every(stream => stream.res.status === 200));
  const extra = await connect(auth);
  assert.equal(extra.res.status, 429);
  assert.equal(live.streamCount(), live.MAX_STREAMS_PER_USER);
});
