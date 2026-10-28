const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test'; process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated'; process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { earningsWindow } = require('../dist/services/earnings-summary.service');
const { captainPayout } = require('../dist/services/earnings.service');
test('payout component rounding adds up to the displayed net across modes and fares', () => {
  for (const mode of ['full', 'shared', 'return']) for (const fare of [0, 1, 9, 10, 2050, 2050.49, 2222.7, 99999]) {
    const p = captainPayout(fare, mode, 100); assert.equal(p.net, p.fare - p.commission + p.incentive);
    assert.ok(Number.isInteger(p.net)); assert.equal(p.perKm, Math.round(p.net / 100 * 10) / 10);
  }
  assert.equal(captainPayout(2050, 'full', 100).net, 1742);
});
test('zero-distance payout does not divide by zero', () => assert.equal(captainPayout(100, 'full', 0).perKm, 0));
test('IST midnight starts the next day while the UTC date is still the previous day', () => {
  assert.equal(earningsWindow(new Date('2026-10-27T18:29:59Z')).today, '2026-10-27');
  assert.equal(earningsWindow(new Date('2026-10-27T18:30:00Z')).today, '2026-10-28');
});
test('Monday begins a new calendar week in IST', () => {
  assert.equal(earningsWindow(new Date('2026-11-01T18:29:59Z')).week, '2026-10-26');
  const w = earningsWindow(new Date('2026-11-01T18:30:00Z'));
  assert.equal(w.week, '2026-11-02'); assert.equal(w.weekly.length, 7); assert.equal(w.weekly[6].date, '2026-11-08');
});
test('a month boundary retains the previous-month portion of the current week', () => {
  const w = earningsWindow(new Date('2026-10-31T18:30:00Z'));
  assert.equal(w.month, '2026-11-01'); assert.equal(w.week, '2026-10-26'); assert.equal(w.since.toISOString(), '2026-10-25T18:30:00.000Z');
});
test('year boundaries preserve the correct week and month', () => {
  const w = earningsWindow(new Date('2026-12-31T18:30:00Z'));
  assert.equal(w.month, '2027-01-01'); assert.equal(w.week, '2026-12-28');
});
