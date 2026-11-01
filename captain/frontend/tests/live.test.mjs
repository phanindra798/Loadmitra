import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/live.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseEventStream, toLiveEvent, retryDelay, startLiveEvents } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const encoder = new TextEncoder();
/** A fake fetch response whose body yields the given chunks, then ends (or stays open). */
function streamResponse(chunks, { status = 200, keepOpen = false } = {}) {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (!keepOpen) controller.close();
    },
  });
  return new Response(status === 200 ? body : null, { status });
}
const until = async (check, label) => {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out: " + label);
};

test("parses complete events and keeps the unfinished remainder", () => {
  const { events, rest } = parseEventStream(
    'retry: 5000\n\n: ping\n\ndata: {"type":"offers"}\r\n\r\ndata: {"type":"tr',
  );
  assert.deepEqual(events, ['{"type":"offers"}']);
  assert.equal(rest, 'data: {"type":"tr');
});

test("accepts only known signal shapes", () => {
  assert.deepEqual(toLiveEvent('{"type":"booking","id":"LM-1"}'), { type: "booking", id: "LM-1" });
  assert.deepEqual(toLiveEvent('{"type":"offers","extra":1}'), { type: "offers" });
  assert.equal(toLiveEvent('{"type":"booking"}'), null);
  assert.equal(toLiveEvent('{"type":"resync"}'), null, "resync is local only");
  assert.equal(toLiveEvent("not json"), null);
});

test("backs off exponentially up to 30 seconds", () => {
  const mid = () => 0.5;
  assert.equal(retryDelay(1, mid), 1000);
  assert.equal(retryDelay(3, mid), 4000);
  assert.equal(retryDelay(20, mid), 30000);
  assert.ok(retryDelay(20, () => 1) <= 37500);
});

test("delivers events split across chunks with the session header", async () => {
  const seen = [];
  const statuses = [];
  let request;
  const stop = startLiveEvents({
    url: "http://isolated.test/api/events",
    token: "token-1",
    onEvent: (event) => seen.push(event),
    onStatus: (value) => statuses.push(value),
    fetchImpl: async (url, init) => {
      request = { url, init };
      return streamResponse(['data: {"type":"booking","id":"LM', '-1"}\n', "\n"], {
        keepOpen: true,
      });
    },
  });
  await until(() => seen.length === 1, "event");
  assert.deepEqual(seen, [{ type: "booking", id: "LM-1" }]);
  assert.equal(request.init.headers.Authorization, "Bearer token-1");
  assert.deepEqual(statuses, [true]);
  stop();
  await until(() => statuses.at(-1) === false, "stopped");
});

test("stops for good when the session is rejected", async () => {
  let calls = 0;
  const statuses = [];
  startLiveEvents({
    url: "x",
    token: "revoked",
    onEvent: () => {},
    onStatus: (value) => statuses.push(value),
    fetchImpl: async () => {
      calls++;
      return streamResponse([], { status: 401 });
    },
  });
  await until(() => statuses.length === 1, "status");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(calls, 1);
  assert.deepEqual(statuses, [false]);
});

test("a resumed start resyncs as soon as it opens", async () => {
  const seen = [];
  const stop = startLiveEvents({
    url: "x",
    token: "t",
    resumed: true,
    onEvent: (event) => seen.push(event),
    onStatus: () => {},
    fetchImpl: async () => streamResponse([], { keepOpen: true }),
  });
  await until(() => seen.length === 1, "resync");
  assert.deepEqual(seen, [{ type: "resync" }]);
  stop();
});

test("reconnects after a drop and asks for a resync", async () => {
  const seen = [];
  let calls = 0;
  const stop = startLiveEvents({
    url: "x",
    token: "t",
    onEvent: (event) => seen.push(event),
    onStatus: () => {},
    fetchImpl: async () => {
      calls++;
      // First stream ends at once (a dropped connection); the second stays open.
      return calls === 1
        ? streamResponse([])
        : streamResponse(['data: {"type":"offers"}\n\n'], { keepOpen: true });
    },
  });
  await until(() => seen.length === 2, "resync and event");
  assert.deepEqual(seen, [{ type: "resync" }, { type: "offers" }]);
  stop();
});
