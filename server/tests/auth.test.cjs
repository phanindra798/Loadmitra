const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated_tests';
process.env.JWT_SECRET = 'isolated-tests-only-secret-not-for-production';
const { Otp } = require('../dist/models/otp.model');
const { User } = require('../dist/models/user.model');
const { sendOtp, verifyOtp } = require('../dist/controllers/auth.controller');
const { createApp } = require('../dist/app');
let challenge, user;
const identity = { phone: '9000000000', role: 'shipper' };
function reset() {
  challenge = null;
  user = { _id: 'test-user', ...identity, name: 'Test User', email: '', dialCode: '+91' };
}
function response() { return { code: 200, body: null, status(n) { this.code=n; return this; }, json(v) { this.body=v; return this; }, cookie() {} }; }
// Replace persistence only; run the actual auth handlers and HTTP middleware.
Otp.findOneAndUpdate = async (query, update) => {
  if (update.$set) { challenge = { _id: 'challenge', ...identity, ...update.$set }; return {...challenge}; }
  assert.ok(query.expiresAt.$gt instanceof Date);
  assert.equal(query.attempts.$lt, 5);
  if (!challenge || challenge.phone !== query.phone || challenge.role !== query.role || challenge.expiresAt <= query.expiresAt.$gt || challenge.attempts >= query.attempts.$lt) return null;
  challenge.attempts++; return {...challenge};
};
Otp.findOneAndDelete = async q => {
  if (!challenge || challenge._id !== q._id || challenge.codeHash !== q.codeHash || challenge.expiresAt <= q.expiresAt.$gt || challenge.attempts > q.attempts.$lte) return null;
  const old = challenge; challenge=null; return old;
};
User.findOne = async () => user;
User.create = async data => (user = { _id: 'new-user', ...data });
async function send() { const r=response(); await sendOtp({body:identity},r); return r.body.devOtp; }
async function verify(otp, extra={}) { const r=response(); await verifyOtp({body:{...identity,otp,...extra}},r); return r; }

test('arbitrary code without a challenge cannot sign in', async()=> { reset(); assert.equal((await verify('000000')).code,401); });
test('code is hashed at rest, valid once, and cannot be replayed', async()=> { reset(); const code=await send(); assert.match(code,/^\d{6}$/); assert.notEqual(challenge.codeHash,code); assert.equal(challenge.code,undefined); const r=await verify(code); assert.equal(r.code,200); assert.ok(r.body.token); assert.equal((await verify(code)).code,401); });
test('expired code is rejected even before Mongo TTL deletion', async()=> { reset(); const code=await send(); challenge.expiresAt=new Date(0); assert.equal((await verify(code)).code,401); });
test('five wrong attempts lock the challenge', async()=> { reset(); const code=await send(); for(let i=0;i<5;i++) assert.equal((await verify('000000')).code,401); assert.equal((await verify(code)).code,401); });
test('resending invalidates the earlier code', async()=> { reset(); const old=await send(); let fresh=await send(); while(fresh===old) fresh=await send(); assert.equal((await verify(old)).code,401); assert.equal((await verify(fresh)).code,200); });
test('registration can collect a profile before consuming the challenge', async()=> { reset(); user=null; const code=await send(); assert.equal((await verify(code)).code,409); assert.ok(challenge); assert.equal((await verify(code,{name:'New User'})).code,200); });
test('concurrent verification issues only one token', async()=> { reset(); const code=await send(); const results=await Promise.all([verify(code),verify(code)]); assert.deepEqual(results.map(r=>r.code).sort(),[200,401]); });
test('production cannot use development OTP delivery', ()=> {
 const { spawnSync }=require('node:child_process');
 const result=spawnSync(process.execPath,['-e', `const c=require('./dist/controllers/auth.controller'); const r={status(n){this.code=n;return this},json(v){console.log(this.code)}}; Promise.all([c.sendOtp({body:{}},r),c.verifyOtp({body:{}},r)]);`],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr); assert.equal(result.stdout.trim(),'503\n503');
});
test('database rejection returns HTTP 500 and malformed JSON returns 400', async()=> {
 reset(); const saved=User.findById; User.findById=async()=>{throw new Error('synthetic database failure')};
 const server=createApp().listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
 try {
  const base='http://127.0.0.1:'+server.address().port;
  const {signToken}=require('../dist/middleware/auth');
  let r=await fetch(base+'/api/auth/me',{headers:{Authorization:'Bearer '+signToken({userId:'test-user',role:'shipper'})},signal:AbortSignal.timeout(3000)});
  assert.equal(r.status,500); assert.deepEqual(await r.json(),{error:'Internal server error'});
  r=await fetch(base+'/api/auth/send-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{',signal:AbortSignal.timeout(3000)});
  assert.equal(r.status,400); await r.text();
 } finally {User.findById=saved;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
