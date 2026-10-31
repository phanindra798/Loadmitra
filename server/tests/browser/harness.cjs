// Shared browser test stack: isolated MongoDB -> Express API -> a portal's Vite
// dev server -> installed Chrome/Edge driven over CDP. No browser package,
// download, existing profile, or production database is used.
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

/** Mutable stack state; `page` is the default CDP session for every helper. */
const state = { directory: undefined, apiServer: undefined, base: undefined, origin: undefined, ws: undefined, page: undefined, signToken: undefined, artifactDir: undefined };
const children = [];
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
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => appendFileSync(join(state.artifactDir, 'processes.log'), data));
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
    state.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression, session = state.page) {
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
const body = (session = state.page) => evaluate('document.body?.innerText ?? ""', session);
async function see(text, session = state.page) { await until(async () => (await body(session)).includes(text), 'visible text: ' + text); }
async function loadPage(method, params, session = state.page) {
  await new Promise((resolveLoad, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('Navigation did not finish')); }, 45000);
    const handler = message => { if (message.sessionId === session && message.method === 'Page.loadEventFired') { stop(); resolveLoad(); } };
    const stop = () => { clearTimeout(timer); const index = events.indexOf(handler); if (index >= 0) events.splice(index, 1); };
    events.push(handler);
    void cdp(method, params, session).catch(error => { stop(); reject(error); });
  });
  // Server-rendered markup is visible before React attaches its handlers; clicks
  // made in that window are silently lost, so wait for hydration.
  await until(() => evaluate(`location.origin !== ${JSON.stringify(state.origin)} ||
    Object.keys(document.body ?? {}).some(key => key.startsWith('__reactFiber') || key.startsWith('__reactContainer'))
    || [...document.querySelectorAll('button')].some(el => Object.keys(el).some(key => key.startsWith('__reactProps')))`, session), 'React hydration');
  // Both portals remount their signed-in tree once after hydration (the server
  // renders as a guest). Wait for the DOM to go quiet so clicks hit the final tree.
  await evaluate(`new Promise(resolve => {
    let timer; const done = () => { observer.disconnect(); resolve(true); };
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, 400); });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(done, 400); setTimeout(done, 5000);
  })`, session);
}
async function navigate(path, session = state.page) { await loadPage('Page.navigate', { url: state.origin + path }, session); }
async function click(text, session = state.page) {
  const found = await evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)}) && !b.disabled); if (!el) return false; el.click(); return true; })()`, session);
  assert.ok(found, 'clickable button: ' + text);
}
/** Clicks again until `effect` holds; for screens that re-render while settling. */
async function clickUntil(text, effect, label, session = state.page) {
  await until(async () => {
    if (await effect()) return true;
    await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)}) && !b.disabled)?.click()`, session);
    await new Promise(resolve => setTimeout(resolve, 500));
    return effect();
  }, label);
}
/** Sets or clears the portal's session through its own API client module. */
async function sessionToken(token, session = state.page) {
  await evaluate(`import('/src/lib/api.ts').then(api => api.${token ? 'setToken(' + JSON.stringify(token) + ')' : 'clearToken()'})`, session);
}
const tokenFor = user => state.signToken({ userId: String(user._id), role: user.role });
async function post(path, user, data = {}) {
  // Bounded so a stalled request fails at its step instead of hanging the suite.
  const response = await fetch(state.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenFor(user) }, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) });
  assert.ok(response.ok, `${path}: ${response.status}`); return response.json();
}
async function screenshot(name) {
  const result = await cdp('Page.captureScreenshot', { format: 'png' }, state.page);
  writeFileSync(join(state.artifactDir, name + '.png'), Buffer.from(result.data, 'base64'));
}
async function recordFailure() {
  if (!state.page) return;
  await screenshot('failure').catch(() => {});
  writeFileSync(join(state.artifactDir, 'failure.txt'), await body().catch(() => 'No browser body'));
}

/** Starts MongoDB, the API and `portal` ('captain' | 'shipper'), then a headless browser with one page. */
async function startStack(portal) {
  state.artifactDir = resolve(__dirname, '../../node_modules/.cache/loadmitra-browser' + (portal === 'captain' ? '' : '-' + portal));
  mkdirSync(state.artifactDir, { recursive: true }); writeFileSync(join(state.artifactDir, 'processes.log'), '');
  state.directory = mkdtempSync(join(tmpdir(), 'loadmitra-browser-test-'));
  const dbPath = join(state.directory, 'db'); mkdirSync(dbPath);
  const mongoPort = await freePort();
  const mongo = start(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', dbPath, '--port', String(mongoPort), '--bind_ip', '127.0.0.1', '--quiet', '--logpath', join(state.directory, 'mongo.log'), '--setParameter', 'diagnosticDataCollectionEnabled=false']);
  await until(async () => {
    if (mongo.startError) throw mongo.startError;
    try { await mongoose.connect(`mongodb://127.0.0.1:${mongoPort}/loadmitra_browser_test`, { serverSelectionTimeoutMS: 500, autoIndex: false }); return true; } catch { return false; }
  }, 'isolated MongoDB');
  await Booking.createIndexes(); await User.createIndexes(); await ensureActiveTripIndex();
  const frontPort = await freePort(); state.origin = 'http://127.0.0.1:' + frontPort;
  process.env.CORS_ORIGIN = state.origin;
  const { createApp } = require('../../dist/app');
  ({ signToken: state.signToken } = require('../../dist/middleware/auth'));
  state.apiServer = createApp().listen(0, '127.0.0.1'); await once(state.apiServer, 'listening');
  state.base = 'http://127.0.0.1:' + state.apiServer.address().port;
  const frontend = resolve(__dirname, `../../../${portal}/frontend`);
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontPort)], { cwd: frontend, env: { ...process.env, NODE_ENV: 'development', VITE_API_URL: state.base } });
  await until(async () => {
    if (vite.startError || vite.exitCode !== null) throw vite.startError ?? new Error('Vite exited; see processes.log');
    try { return (await fetch(state.origin + '/login')).ok; } catch { return false; }
  }, portal + ' dev server', 45000);
  const profile = join(state.directory, 'browser-profile');
  const browser = start(process.env.BROWSER_BINARY || 'google-chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank']);
  const activePort = join(profile, 'DevToolsActivePort');
  await until(() => { if (browser.startError) throw browser.startError; return existsSync(activePort); }, 'isolated browser');
  const [port, path] = readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
  state.ws = new WebSocket(`ws://127.0.0.1:${port}${path}`); await once(state.ws, 'open');
  state.ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = waiting.get(message.id); if (!call) return; waiting.delete(message.id);
      if (message.error) call.reject(new Error(message.error.message)); else call.resolve(message.result);
    } else {
      if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      for (const handler of events) handler(message);
    }
  });
  state.page = await newPage();
  return state;
}

async function stopStack() {
  if (state.ws?.readyState === WebSocket.OPEN) { await cdp('Browser.close').catch(() => {}); state.ws.close(); }
  if (state.apiServer) { state.apiServer.closeAllConnections(); await new Promise(resolve => state.apiServer.close(resolve)); }
  await mongoose.disconnect();
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  if (state.directory) rmSync(state.directory, { recursive: true, force: true, maxRetries: 15, retryDelay: 200 });
  if (state.artifactDir) writeFileSync(join(state.artifactDir, 'results.json'), JSON.stringify({ phases, browserErrors }, null, 2));
}

module.exports = {
  state, Booking, User, browserErrors, events, mark, until, cdp, evaluate, newPage, body, see, loadPage,
  navigate, click, clickUntil, sessionToken, tokenFor, post, screenshot, recordFailure, startStack, stopStack,
};
