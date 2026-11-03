const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { RevokedToken } = require('../dist/models/revoked-token.model');
// No database in this suite: nothing is revoked.
RevokedToken.exists = async () => null;
const { createApp } = require('../dist/app');
const { signToken } = require('../dist/middleware/auth');

let server, base;
before(async () => {
  server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

test('health reports 503 while MongoDB is not connected', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.status, 'degraded');
  assert.equal(body.db, 'down');
});

test('captain limits count per account, so one busy captain does not block another on the same IP', async () => {
  const quote = user => fetch(base + '/api/captain/earnings/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken({ userId: user, role: 'captain' }) },
    body: JSON.stringify({ truckTypeId: 'ace', mode: 'full', distanceKm: 100 }),
  });
  for (let i = 0; i < 30; i++) assert.equal((await quote('captain-busy')).status, 200);
  const limited = await quote('captain-busy');
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await quote('captain-other')).status, 200);
});
