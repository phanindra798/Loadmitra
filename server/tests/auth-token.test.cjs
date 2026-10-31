const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const jwt = require('jsonwebtoken');
const { RevokedToken } = require('../dist/models/revoked-token.model');
const { requireAuth, signToken } = require('../dist/middleware/auth');
const { logout } = require('../dist/controllers/auth.controller');
// Revocation list kept in memory; the real collection is covered by integration tests.
let revoked = new Map();
RevokedToken.exists = async ({ jti }) => (revoked.has(jti) ? { _id: jti } : null);
RevokedToken.updateOne = async ({ jti }, update) => { revoked.set(jti, update.$setOnInsert); return { acknowledged: true }; };
async function authenticate(token, cookie) {
  const req = { headers: token === undefined ? {} : { authorization: 'Bearer ' + token }, cookies: { lm_token: cookie } };
  const res = { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, json(v) { this.body=v; } };
  let called = false;
  await requireAuth(req, res, () => { called = true; });
  return { req, res, called };
}
const valid = { userId: 'captain-a', role: 'captain' };
const withId = { jwtid: 'session-1', expiresIn: '1h' };
for (const payload of [{ role: 'captain' }, { ...valid, userId: 42 }, { ...valid, userId: ' ' }, { ...valid, userId: 'a'.repeat(129) }, { ...valid, role: 'admin' }, { userId: 'captain-a' }]) {
  test('reject malformed signed claims: ' + JSON.stringify(payload), async () => {
    const result = await authenticate(jwt.sign(payload, process.env.JWT_SECRET, withId));
    assert.equal(result.res.code, 401); assert.equal(result.called, false); assert.equal(result.req.auth, undefined);
  });
}
test('tokens must expire and use the application signing algorithm', async () => {
  for (const token of [jwt.sign(valid, process.env.JWT_SECRET, { jwtid: 'x' }), jwt.sign(valid, process.env.JWT_SECRET, { algorithm: 'HS384', ...withId }), jwt.sign(valid, process.env.JWT_SECRET, { jwtid: 'x', expiresIn: -1 })]) {
    assert.equal((await authenticate(token)).res.code, 401);
  }
});
test('tokens without a session id predate revocation and must sign in again', async () => {
  const legacy = jwt.sign(valid, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await authenticate(legacy)).res.code, 401);
});
test('issued tokens work via bearer and cookie and expose only identity claims', async () => {
  const token = signToken(valid);
  assert.equal(typeof jwt.decode(token).jti, 'string');
  for (const result of [await authenticate(token), await authenticate(undefined, token)]) {
    assert.equal(result.called, true); assert.deepEqual(result.req.auth, valid);
    assert.equal(result.res.headers['Cache-Control'], 'no-store');
  }
});
test('invalid bearer cannot fall back to a valid cookie and failures cannot be cached', async () => {
  for (const result of [await authenticate('invalid', signToken(valid)), await authenticate(undefined)]) {
    assert.equal(result.res.code, 401); assert.equal(result.called, false);
    assert.equal(result.res.headers['Cache-Control'], 'no-store');
  }
});
test('logout revokes only that session until it would have expired', async () => {
  revoked = new Map();
  const ended = signToken(valid); const other = signToken(valid);
  const res = { cleared: false, clearCookie() { this.cleared = true; }, json(v) { this.body = v; } };
  await logout({ headers: { authorization: 'Bearer ' + ended }, cookies: {} }, res);
  assert.equal(res.cleared, true); assert.deepEqual(res.body, { ok: true });
  assert.equal((await authenticate(ended)).res.code, 401);
  assert.equal((await authenticate(other)).called, true);
  const entry = [...revoked.values()][0];
  assert.equal(entry.expiresAt.getTime(), jwt.decode(ended).exp * 1000);
});
test('logout without a valid token still clears the cookie and revokes nothing', async () => {
  revoked = new Map();
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) {
    const res = { cleared: false, clearCookie() { this.cleared = true; }, json(v) { this.body = v; } };
    await logout({ headers, cookies: {} }, res);
    assert.equal(res.cleared, true);
  }
  assert.equal(revoked.size, 0);
});
test('a database outage refuses the request instead of skipping the revocation check', async () => {
  const original = RevokedToken.exists;
  RevokedToken.exists = async () => { throw new Error('synthetic outage'); };
  try {
    const result = await authenticate(signToken(valid));
    assert.equal(result.res.code, 503); assert.equal(result.called, false);
  } finally { RevokedToken.exists = original; }
});
