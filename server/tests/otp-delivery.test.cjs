const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

// env.ts is read once per process, so each mode is checked in its own child.
function delivery(extra) {
  const script = "const { env } = require('./dist/config/env'); process.stdout.write(env.otpDelivery);";
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8',
    env: { PATH: process.env.PATH, MONGODB_URI: 'mongodb://127.0.0.1:1/isolated',
      JWT_SECRET: 'isolated-tests-only-secret-not-for-production', ...extra },
  });
  assert.equal(result.status, 0, result.stderr);
  return { mode: result.stdout, warning: result.stderr };
}

test('production defaults to SMS delivery, which stays unavailable until an adapter exists', () => {
  assert.equal(delivery({ NODE_ENV: 'production' }).mode, 'sms');
  assert.equal(delivery({ NODE_ENV: 'development' }).mode, 'screen');
});

test('an explicit on-screen demo mode in production is allowed but warns loudly', () => {
  const result = delivery({ NODE_ENV: 'production', OTP_DELIVERY: 'screen' });
  assert.equal(result.mode, 'screen');
  assert.match(result.warning, /anyone can sign in/);
});
