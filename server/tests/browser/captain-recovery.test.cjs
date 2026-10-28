// Browser -> Express -> isolated MongoDB. Uses installed Chrome/Edge and CDP;
// no browser package, download, existing profile, or production database is used.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync, readFileSync, appendFileSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/isolated';
process.env.JWT_SECRET = 'browser-tests-only-secret-not-for-production';
const mongoose = require('mongoose');
const { Booking } = require('../../dist/models/booking.model');
const { User } = require('../../dist/models/user.model');
const { ensureActiveTripIndex } = require('../../dist/services/active-trip.service');
const children = [];
const artifactDir = resolve(__dirname, '../../node_modules/.cache/loadmitra-browser');
let directory, apiServer, base, origin, ws, page, captainA, captainB, owner, tokenA, tokenB, signToken;
let sequence = 0;
const waiting = new Map();
const browserErrors = [];
const events = [];
const phases = [];
const mark = label => { phases.push(label); console.log('VERIFIED:', label); };
async function freePort() {
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve)); return port;
}
function start(binary, args, options = {}) {
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options }); children.push(child);
  child.on('error', error => { child.startError = error; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => appendFileSync(join(artifactDir, 'processes.log'), data));
  return child;
}
async function until(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await check()) return; await delay(150); }
  throw new Error('Timed out: ' + label);
}
function cdp(method, params = {}, sessionId) {
  return new Promise((resolveCall, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    waiting.set(id, { resolve: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression, session = page) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function newPage() {
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  await cdp('Runtime.enable', {}, sessionId); await cdp('Page.enable', {}, sessionId); await cdp('Network.enable', {}, sessionId);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  return sessionId;
}
const body = () => evaluate('document.body?.innerText ?? ""');
async function see(text) { await until(async () => (await body()).includes(text), 'visible text: ' + text); }
async function loadPage(method, params, session = page) {
  await new Promise((resolveLoad, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('Navigation did not finish')); }, 45000);
    const handler = message => { if (message.sessionId === session && message.method === 'Page.loadEventFired') { stop(); resolveLoad(); } };
    const stop = () => { clearTimeout(timer); const index = events.indexOf(handler); if (index >= 0) events.splice(index, 1); };
    events.push(handler);
    void cdp(method, params, session).catch(error => { stop(); reject(error); });
  });
}
async function navigate(path, session = page) { await loadPage('Page.navigate', { url: origin + path }, session); }
async function click(text) {
  const found = await evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)}) && !b.disabled); if (!el) return false; el.click(); return true; })()`);
  assert.ok(found, 'clickable button: ' + text);
}
async function sessionToken(token, session = page) {
  await evaluate(`import('/src/lib/api.ts').then(api => api.${token ? 'setToken(' + JSON.stringify(token) + ')' : 'clearToken()'})`, session);
}
async function post(path, user, data = {}) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signToken({ userId: String(user._id), role: user.role }) }, body: JSON.stringify(data) });
  assert.ok(response.ok, `${path}: ${response.status}`); return response.json();
}
async function screenshot(name) {
  const result = await cdp('Page.captureScreenshot', { format: 'png' }, page);
  writeFileSync(join(artifactDir, name + '.png'), Buffer.from(result.data, 'base64'));
}

before(async () => {
  mkdirSync(artifactDir, { recursive: true }); writeFileSync(join(artifactDir, 'processes.log'), '');
  directory = mkdtempSync(join(tmpdir(), 'loadmitra-browser-test-'));
  const dbPath = join(directory, 'db'); mkdirSync(dbPath);
  const mongoPort = await freePort();
  const mongo = start(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet', '--logpath', join(directory, 'mongo.log'), '--setParameter', 'diagnosticDataCollectionEnabled=false']);
  await until(async () => {
    if (mongo.startError) throw mongo.startError;
    try { await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/loadmitra_browser_test`, { serverSelectionTimeoutMS: 500, autoIndex: false }); return true; } catch { return false; }
  }, 'isolated MongoDB');
  await Booking.createIndexes(); await User.createIndexes(); await ensureActiveTripIndex();
  const frontPort = await freePort(); origin = 'http://127.0.0.1:' + frontPort;
  process.env.CORS_ORIGIN = origin;
  const { createApp } = require('../../dist/app');
  ({ signToken } = require('../../dist/middleware/auth'));
  apiServer = createApp().listen(0, '127.0.0.1'); await once(apiServer, 'listening'); base = 'http://127.0.0.1:' + apiServer.address().port;
  [captainA, captainB, owner] = await User.create([
    { role: 'captain', name: 'Browser Captain Alpha', phone: '9000000011', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'captain', name: 'Browser Captain Beta', phone: '9000000012', vehicle: { vehicleNumber: 'TS09AB1234', truckTypeId: 'ace', city: 'Hyderabad' } },
    { role: 'shipper', name: 'Browser Shipper', phone: '9000000013' },
  ]);
  tokenA = signToken({ userId: String(captainA._id), role: 'captain' }); tokenB = signToken({ userId: String(captainB._id), role: 'captain' });
  const load = (id, pickup, extra = {}) => ({ bookingId: id, shipperId: String(owner._id), mode: 'full', pickup: { label: pickup, city: pickup, address: pickup + ' address, Test City' }, drop: { label: 'Browser destination', city: 'Destination', address: '456 Destination Road, Test City' }, distanceKm: 100, truckTypeId: 'ace', truckTypeName: 'Tata Ace', loadWeightKg: 500, agreedPrice: 2050, ...extra });
  await Booking.create(load('LM-BROWSER-ALPHA', 'Alpha pickup'));
  await Booking.create(load('LM-BROWSER-BETA', 'Beta pickup'));
  await post('/api/captain/requests/LM-BROWSER-ALPHA/accept', captainA);
  await post('/api/captain/requests/LM-BROWSER-BETA/accept', captainB);
  await Booking.create(load('LM-BROWSER-OLD', 'Historical pickup', { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id), createdAt: new Date('2020-01-01') }));
  await Booking.insertMany(Array.from({ length: 101 }, (_, i) => load('LM-BROWSER-HISTORY-' + i, 'History ' + i, { status: 'accepted', tripStatus: 'delivered', acceptedByCaptainId: String(captainA._id), createdAt: new Date('2025-01-01') })));
  const frontend = resolve(__dirname, '../../../captain/frontend');
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontPort)], { cwd: frontend, env: { ...process.env, NODE_ENV: 'development', VITE_API_URL: base } });
  await until(async () => {
    if (vite.startError || vite.exitCode !== null) throw vite.startError ?? new Error('Vite exited; see processes.log');
    try { return (await fetch(origin + '/login')).ok; } catch { return false; }
  }, 'captain dev server', 45000);
  const profile = join(directory, 'browser-profile');
  const browser = start(process.env.BROWSER_BINARY || 'google-chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank']);
  const activePort = join(profile, 'DevToolsActivePort');
  await until(() => { if (browser.startError) throw browser.startError; return existsSync(activePort); }, 'isolated browser');
  const [port, path] = readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
  ws = new WebSocket(`ws://127.0.0.1:${port}${path}`); await once(ws, 'open');
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = waiting.get(message.id); if (!call) return; waiting.delete(message.id);
      if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
    } else {
      if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      for (const handler of events) handler(message);
    }
  });
  page = await newPage();
}, { timeout: 110000 });

after(async () => {
  if (ws?.readyState === WebSocket.OPEN) { await cdp('Browser.close').catch(() => {}); ws.close(); }
  if (apiServer) { apiServer.closeAllConnections(); await new Promise(resolve => apiServer.close(resolve)); }
  await mongoose.disconnect();
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  if (directory) rmSync(directory, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  writeFileSync(join(artifactDir, 'results.json'), JSON.stringify({ phases, browserErrors }, null, 2));
});

test('captain recovery and account isolation through the browser, API and database', { timeout: 150000 }, async () => {
  try {
    await navigate('/app/trips'); await see('Sign in');
    await sessionToken(tokenA); await see('Alpha pickup');
    await navigate('/app/trip/LM-BROWSER-ALPHA'); await see('Load accepted');
    await loadPage('Page.reload', {}); await see('Head to pickup');
    assert.ok((await body()).includes('Alpha pickup address, Test City'));
    assert.ok((await body()).includes('456 Destination Road, Test City'));
    mark('Active trip survives direct navigation and reload');

    await click('Head to pickup'); await see("I've arrived at pickup");
    assert.equal((await Booking.findOne({ bookingId: 'LM-BROWSER-ALPHA' })).tripStatus, 'enroute_pickup');
    mark('Browser action persists its lifecycle transition in MongoDB');

    await post('/api/bookings/LM-BROWSER-ALPHA/cancel', owner);
    await see('Trip cancelled'); assert.equal((await body()).includes("I've arrived at pickup"), false);
    await screenshot('cancelled-trip');
    mark('Shipper cancellation reaches the captain screen and removes actions');

    await sessionToken(tokenB); await see('Trip not found');
    assert.equal((await body()).includes('Alpha pickup'), false);
    await navigate('/app/trips'); await see('Beta pickup');
    assert.equal((await body()).includes('Alpha pickup'), false);
    await loadPage('Page.reload', {}); await see('Beta pickup');
    mark('Account switch clears Alpha data and restores only Beta data after reload');

    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'enroute_pickup' });
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'at_pickup' });
    const pickupCode = (await post('/api/bookings/LM-BROWSER-BETA/handover-otp', owner)).data.code;
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'picked', otp: pickupCode });
    await post('/api/captain/trips/LM-BROWSER-BETA/status', captainB, { status: 'enroute_drop' });
    const deliveryCode = (await post('/api/bookings/LM-BROWSER-BETA/handover-otp', owner)).data.code;
    await navigate('/app/trip/LM-BROWSER-BETA'); await see('Verify drop OTP');
    assert.ok(await evaluate(`(() => { const input = document.querySelector('input[data-input-otp]'); input?.focus(); return Boolean(input); })()`));
    await cdp('Input.insertText', { text: deliveryCode }, page);
    await until(async () => evaluate(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('Verify drop OTP') && !button.disabled)`), 'enabled delivery verification');
    await click('Verify drop OTP'); await see('Delivery confirmed');
    const delivered = await Booking.findOne({ bookingId: 'LM-BROWSER-BETA' });
    assert.equal(delivered.payoutSnapshot.net, 1742); assert.ok(delivered.completedAt);
    await navigate('/app/earnings');
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'saved delivery earnings');
    await loadPage('Page.reload', {});
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'earnings survive refresh without doubling');
    assert.ok((await body()).includes('Beta pickup')); await screenshot('saved-earnings');
    mark('Browser-verified delivery saves a payout once, and earnings survive reload');


    await navigate('/app/account'); await see('Saved vehicle: TS09AB1234');
    for (const [id, value] of [['vehicle-number', 'ts-09 xy 7654'], ['vehicle-city', 'Warangal']]) {
      assert.ok(await evaluate(`(() => { const input = document.getElementById(${JSON.stringify(id)}); input?.focus(); input?.select(); return Boolean(input); })()`));
      await cdp('Input.insertText', { text: value }, page);
    }
    await click('Save vehicle'); await see('Saved vehicle: TS09XY7654');
    await loadPage('Page.reload', {}); await see('Saved vehicle: TS09XY7654');
    assert.equal(await evaluate(`document.getElementById('vehicle-city')?.value`), 'Warangal');
    const registered = await User.findById(captainB._id);
    assert.equal(registered.vehicle.vehicleNumber, 'TS09XY7654'); assert.equal(registered.vehicle.city, 'Warangal');
    assert.equal((await Booking.findOne({ bookingId: 'LM-BROWSER-BETA' })).captain.vehicleNumber, 'TS09AB1234');
    assert.ok((await body()).includes('Not submitted')); assert.equal((await body()).includes('Verified'), false);
    await screenshot('saved-vehicle');
    await sessionToken(tokenA); await see('Saved vehicle: TS09AB1234');
    assert.equal((await body()).includes('TS09XY7654'), false);
    await sessionToken(tokenB); await see('Saved vehicle: TS09XY7654');
    mark('Vehicle registration survives reload, preserves historical assignments, stays unverified and is isolated by account');
    await navigate('/app/earnings');
    await until(async () => (await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`)) === '₹1,742', 'return to Beta earnings');

    const second = await newPage(); await navigate('/app/trips', second);
    await until(async () => (await evaluate('document.body?.innerText ?? ""', second)).includes('Beta pickup'), 'second tab');
    await sessionToken(tokenA, second); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    assert.equal((await body()).includes('Beta pickup'), false);
    await navigate('/app/trips'); await see('Alpha pickup');
    assert.equal((await body()).includes('Beta pickup'), false);
    mark('Another tab changing accounts resets the original tab through storage notification');

    await navigate('/app/trip/LM-BROWSER-OLD'); await see('Historical pickup'); await see('Delivery confirmed');
    assert.ok((await body()).includes('LM-BROWSER-OLD'));
    mark('A direct link restores a delivered trip outside the recent 100 records');

    await sessionToken(null); await see('Sign in to view this trip');
    assert.equal((await body()).includes('Historical pickup'), false);
    mark('Logout clears private trip details immediately');

    await sessionToken(tokenA); await navigate('/app/trips'); await see('Alpha pickup');
    const failReads = message => {
      if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page) return;
      void cdp('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 503,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }],
        body: Buffer.from(JSON.stringify({ error: 'Temporary browser-test outage' })).toString('base64') }, page).catch(() => {});
    };
    events.push(failReads);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: base + '/api/captain/trips*', requestStage: 'Request' }] }, page);
    await loadPage('Page.reload', {}); await see('Could not refresh trips.');
    assert.equal((await body()).includes('No trips here yet'), false);
    await cdp('Fetch.disable', {}, page); events.splice(events.indexOf(failReads), 1);
    await click('Retry'); await see('Alpha pickup');
    mark('An API failure shows an error instead of empty history, and Retry recovers');
    await screenshot('recovered-history');
    await navigate('/app/earnings'); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    assert.equal((await body()).includes('Beta pickup'), false);
    assert.equal((await body()).includes('+12%'), false);
    assert.equal((await body()).includes('₹500 bonus'), false);
    mark('Legacy completions are labelled and another captain earnings never leak');
    events.push(failReads);
    await cdp('Fetch.enable', { patterns: [{ urlPattern: base + '/api/captain/earnings', requestStage: 'Request' }] }, page);
    await loadPage('Page.reload', {}); await see('Could not load earnings.');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-testid="earnings-total"]'))`), false);
    await cdp('Fetch.disable', {}, page); events.splice(events.indexOf(failReads), 1);
    await click('Retry earnings'); await see('102 older completed trip(s)');
    assert.equal(await evaluate(`document.querySelector('[data-testid="earnings-total"]')?.textContent`), '₹0');
    mark('An earnings outage displays an error and retry recovers the saved summary');
    assert.deepEqual(browserErrors, []);
    mark('No uncaught browser exceptions');
  } catch (error) {
    if (page) { await screenshot('failure').catch(() => {}); writeFileSync(join(artifactDir, 'failure.txt'), await body().catch(() => 'No browser body')); }
    throw error;
  }
});
