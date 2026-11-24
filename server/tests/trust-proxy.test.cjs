const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
process.env.TRUST_PROXY = '1';
const { createApp } = require('../dist/app');

// Behind a load balancer, rate limits must key on the client, not the proxy.
test('configured proxy hops resolve the client IP from X-Forwarded-For', () => {
  const app = createApp();
  assert.equal(app.get('trust proxy'), 1);
  const trust = app.get('trust proxy fn');
  assert.equal(trust('10.0.0.5', 0), true);   // the load balancer itself
  assert.equal(trust('203.0.113.9', 1), false); // a client-supplied extra hop is not trusted
});
