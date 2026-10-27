import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const storage = compile(await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8'));
const records = compile(await readFile(new URL('../src/features/captain/trip-record.ts', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8'))
  .replace('"./storage"', JSON.stringify(storage)).replace('"@/features/captain/trip-record"', JSON.stringify(records)).replace('import.meta.env.VITE_API_URL', '"http://isolated.test"');
const { setToken, getToken, clearToken, subscribeSession, captainApi, ApiError } = await import(compile(source));
const originalFetch = globalThis.fetch;
let cookies, local;
beforeEach(() => {
  cookies = new Map(); local = new Map();
  globalThis.window = new EventTarget();
  globalThis.document = {
    get cookie() { return [...cookies].map(([k,v]) => k + '=' + v).join('; '); },
    set cookie(value) {
      const [pair] = value.split(';'); const i = pair.indexOf('='); const key = pair.slice(0, i);
      if (value.includes('max-age=0')) cookies.delete(key); else cookies.set(key, pair.slice(i + 1));
    },
  };
  globalThis.localStorage = { getItem: key => local.get(key) ?? null, setItem: (key,value) => local.set(key,value), removeItem: key => local.delete(key) };
  globalThis.fetch = async () => Response.json({ data: [] });
});
after(() => { globalThis.fetch = originalFetch; delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; });
test('same-tab login/logout and cross-tab/focus changes notify subscribers and clean up', () => {
  let calls = 0; const stop = subscribeSession(() => calls++);
  setToken('session-a'); assert.equal(getToken(), 'session-a'); clearToken(); assert.equal(getToken(), null);
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' })); assert.equal(calls, 2);
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'lm-captain-token' }));
  window.dispatchEvent(Object.assign(new Event('storage'), { key: null })); window.dispatchEvent(new Event('focus')); assert.equal(calls, 5);
  stop(); setToken('session-b'); window.dispatchEvent(new Event('focus')); assert.equal(calls, 5);
});
test('a successful old-account response is discarded after switching sessions', async () => {
  setToken('session-a'); let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = captainApi.trips(); setToken('session-b'); finish(Response.json({ data: [{ id: 'private-a' }] }));
  await assert.rejects(pending, error => error.name === 'AbortError'); assert.equal(getToken(), 'session-b');
});
test('a delayed unauthorized response cannot log out a newer account', async () => {
  setToken('session-a'); let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = captainApi.trips(); setToken('session-b'); finish(Response.json({ error: 'Expired' }, { status: 401 }));
  await assert.rejects(pending, error => error.name === 'AbortError'); assert.equal(getToken(), 'session-b');
});
test('an expired current captain session clears stored authentication', async () => {
  setToken('session-a'); globalThis.fetch = async () => Response.json({ error: 'Expired' }, { status: 401 });
  await assert.rejects(captainApi.trips(), error => error instanceof ApiError && error.status === 401); assert.equal(getToken(), null);
});
test('cancelled reads remain aborts rather than network failures', async () => {
  setToken('session-a'); const controller = new AbortController(); controller.abort();
  globalThis.fetch = async () => { throw new DOMException('Cancelled', 'AbortError'); };
  await assert.rejects(captainApi.trips(controller.signal), error => error.name === 'AbortError'); assert.equal(getToken(), 'session-a');
});
test('trip detail requests encode IDs, bypass caches and propagate cancellation', async () => {
  setToken('session-a'); const controller = new AbortController();
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://isolated.test/api/captain/trips/LM-a%2Fb');
    assert.equal(init.headers.Authorization, 'Bearer session-a'); assert.equal(init.cache, 'no-store'); assert.equal(init.signal, controller.signal);
    return Response.json({ data: { id: 'LM-a/b' } });
  };
  assert.equal((await captainApi.trip('LM-a/b', controller.signal)).id, 'LM-a/b');
});
test('history includes an older active trip exactly once', async () => {
  setToken('session-a');
  globalThis.fetch = async () => Response.json({ data: [{ id: 'LM-old', status: 'accepted' }, { id: 'LM-done', status: 'delivered' }], activeTrip: { id: 'LM-old', status: 'picked' } });
  const records = await captainApi.trips(); assert.equal(records.length, 2); assert.equal(records[0].status, 'picked');
});
test('acceptance preserves structured conflict codes for recovery', async () => {
  setToken('session-a');
  globalThis.fetch = async () => Response.json({ error: 'Finish your current trip', code: 'ACTIVE_TRIP_EXISTS' }, { status: 409 });
  await assert.rejects(captainApi.accept('LM-new'), error => error.code === 'ACTIVE_TRIP_EXISTS' && error.status === 409);
});

test('a stale active snapshot cannot override newer delivered history in the same response', async () => {
  setToken('session-a');
  globalThis.fetch = async () => Response.json({ data: [{ id: 'LM-one', status: 'delivered', updatedAt: '2026-01-02T00:00:00Z' }], activeTrip: { id: 'LM-one', status: 'enroute_drop', updatedAt: '2026-01-01T00:00:00Z' } });
  assert.equal((await captainApi.trips())[0].status, 'delivered');
});
test('cancellation while reading a response body remains an abort', async () => {
  setToken('session-a');
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  await assert.rejects(captainApi.trips(), error => error.name === 'AbortError');
});
