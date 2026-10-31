const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { Otp } = require('../dist/models/otp.model');
const { User } = require('../dist/models/user.model');
const { sendOtp, verifyOtp } = require('../dist/controllers/auth.controller');

// In-memory persistence that honours every identity field in the query.
let challenges, users;
const same = (doc, q) => ['dialCode', 'phone', 'role'].every(k => doc[k] === q[k]);
Otp.findOneAndUpdate = async (q, update) => {
  if (update.$set) {
    const doc = { _id: q.dialCode + q.phone + q.role, dialCode: q.dialCode, phone: q.phone, role: q.role, ...update.$set };
    challenges = challenges.filter(c => !same(c, q)).concat(doc); return { ...doc };
  }
  const found = challenges.find(c => same(c, q) && c.expiresAt > q.expiresAt.$gt && c.attempts < q.attempts.$lt);
  if (!found) return null; found.attempts++; return { ...found };
};
Otp.findOneAndDelete = async q => {
  const found = challenges.find(c => c._id === q._id && c.codeHash === q.codeHash);
  challenges = challenges.filter(c => c !== found); return found ?? null;
};
User.findOne = async q => users.find(u => same(u, q)) ?? null;
User.create = async data => { const u = { _id: 'user-' + users.length, email: '', ...data }; users.push(u); return u; };
beforeEach(() => { challenges = []; users = []; });

const res = () => ({ code: 200, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; }, cookie() {} });
async function send(body) { const r = res(); await sendOtp({ body }, r); return r; }
async function login(identity, name) {
  const otp = (await send(identity)).body.devOtp;
  const r = res(); await verifyOtp({ body: { ...identity, otp, name } }, r); return r;
}

test('the same digits in two countries are two separate accounts', async () => {
  const india = await login({ phone: '9000000000', role: 'shipper', dialCode: '+91' }, 'Indian Shipper');
  const uk = await login({ phone: '9000000000', role: 'shipper', dialCode: '+44' }, 'UK Shipper');
  assert.equal(india.code, 200); assert.equal(uk.code, 200);
  assert.notEqual(india.body.user.id, uk.body.user.id);
  assert.equal(india.body.user.dialCode, '+91'); assert.equal(uk.body.user.dialCode, '+44');
});

test('a code requested for one country cannot sign in the same number elsewhere', async () => {
  const otp = (await send({ phone: '9000000000', role: 'shipper', dialCode: '+91' })).body.devOtp;
  const r = res(); await verifyOtp({ body: { phone: '9000000000', role: 'shipper', dialCode: '+44', otp, name: 'Intruder' } }, r);
  assert.equal(r.code, 401); assert.equal(users.length, 0);
});

test('older clients without a country code keep signing in as Indian accounts', async () => {
  const r = await login({ phone: '9000000000', role: 'captain' }, 'Legacy Captain');
  assert.equal(r.code, 200); assert.equal(r.body.user.dialCode, '+91');
});

test('Indian numbers are validated strictly and unsupported codes are rejected', async () => {
  for (const body of [
    { phone: '5000000000', role: 'shipper', dialCode: '+91' },   // Indian mobiles start with 6-9
    { phone: '900000000', role: 'shipper', dialCode: '+91' },    // nine digits
    { phone: '9000000000', role: 'shipper', dialCode: '+999' },  // not offered by the app
    { phone: '12345', role: 'shipper', dialCode: '+44' },        // too short anywhere
  ]) {
    const r = await send(body);
    assert.equal(r.code, 400, JSON.stringify(body)); assert.equal(challenges.length, 0);
  }
  assert.equal((await send({ phone: '7700900123', role: 'shipper', dialCode: '+44' })).code, 200);
});
