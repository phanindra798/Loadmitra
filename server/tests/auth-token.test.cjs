const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const jwt = require('jsonwebtoken');
const { requireAuth, signToken } = require('../dist/middleware/auth');
function authenticate(token, cookie) {
  const req = { headers: token === undefined ? {} : { authorization: 'Bearer ' + token }, cookies: { lm_token: cookie } };
  const res = { code: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, json(v) { this.body=v; } };
  let called = false;
  requireAuth(req, res, () => { called = true; });
  return { req, res, called };
}
const valid = { userId: 'captain-a', role: 'captain' };
for (const payload of [{ role: 'captain' }, { ...valid, userId: 42 }, { ...valid, userId: ' ' }, { ...valid, userId: 'a'.repeat(129) }, { ...valid, role: 'admin' }, { userId: 'captain-a' }]) {
  test('reject malformed signed claims: ' + JSON.stringify(payload), () => {
    const result = authenticate(jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }));
    assert.equal(result.res.code, 401); assert.equal(result.called, false); assert.equal(result.req.auth, undefined);
  });
}
test('tokens must expire and use the application signing algorithm', () => {
  for (const token of [jwt.sign(valid, process.env.JWT_SECRET), jwt.sign(valid, process.env.JWT_SECRET, { algorithm: 'HS384', expiresIn: '1h' }), jwt.sign(valid, process.env.JWT_SECRET, { expiresIn: -1 })]) {
    assert.equal(authenticate(token).res.code, 401);
  }
});
test('issued tokens work via bearer and cookie and expose only identity claims', () => {
  const token = signToken(valid);
  for (const result of [authenticate(token), authenticate(undefined, token)]) {
    assert.equal(result.called, true); assert.deepEqual(result.req.auth, valid);
    assert.equal(result.res.headers['Cache-Control'], 'no-store');
  }
});
test('invalid bearer cannot fall back to a valid cookie and failures cannot be cached', () => {
  for (const result of [authenticate('invalid', signToken(valid)), authenticate(undefined)]) {
    assert.equal(result.res.code, 401); assert.equal(result.called, false);
    assert.equal(result.res.headers['Cache-Control'], 'no-store');
  }
});
