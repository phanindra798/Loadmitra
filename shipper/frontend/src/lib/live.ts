/**
 * Live change signals from the API (`GET /api/events`, Server-Sent Events).
 * Read with fetch rather than EventSource so the session goes in the same
 * Bearer header as every other request. Signals only name what changed; the
 * app re-reads it through the normal endpoints. Kept free of React and path
 * aliases so tests can import it directly.
 */

export type LiveEvent =
  | { type: "booking"; id: string }
  | { type: "trip"; id: string }
  | { type: "offers" }
  /** Sent locally after a reconnect: signals may have been missed, so reload everything. */
  | { type: "resync" };

/** Splits buffered stream text into complete `data:` payloads plus the unfinished remainder. */
export function parseEventStream(text: string): { events: string[]; rest: string } {
  const blocks = text.replace(/\r\n?/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: string[] = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) events.push(data);
  }
  return { events, rest };
}

/** Validates one payload; anything unexpected is ignored. */
export function toLiveEvent(data: string): LiveEvent | null {
  try {
    const value = JSON.parse(data) as { type?: unknown; id?: unknown };
    if (value.type === "offers") return { type: "offers" };
    if ((value.type === "booking" || value.type === "trip") && typeof value.id === "string") {
      return { type: value.type, id: value.id };
    }
  } catch {
    /* ignore malformed payloads */
  }
  return null;
}

/** Reconnect delay: 1s, 2s, 4s … capped at 30s, with jitter so tabs don't reconnect together. */
export const retryDelay = (attempt: number, random = Math.random) =>
  Math.round(Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1)) * (0.75 + random() * 0.5));

export interface LiveOptions {
  url: string;
  token: string;
  onEvent: (event: LiveEvent) => void;
  onStatus: (connected: boolean) => void;
  /** Signals may have been missed before this start (e.g. a hidden tab): resync on the first open too. */
  resumed?: boolean;
  fetchImpl?: typeof fetch;
}

/** Keeps a stream open (reconnecting with backoff) until the returned stop function is called. */
export function startLiveEvents({
  url,
  token,
  onEvent,
  onStatus,
  resumed = false,
  fetchImpl = fetch,
}: LiveOptions) {
  const controller = new AbortController();
  const { signal } = controller;
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

  void (async () => {
    let attempt = 0;
    let opened = resumed;
    while (!signal.aborted) {
      try {
        const res = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          cache: "no-store",
          signal,
        });
        // The session ended or is not allowed: stop. Signing in again starts a new stream.
        if (res.status === 401 || res.status === 403) return;
        if (!res.ok || !res.body) throw new Error(`Live updates unavailable (${res.status})`);
        attempt = 0;
        onStatus(true);
        if (opened) onEvent({ type: "resync" });
        opened = true;
        const reader = res.body.getReader();
        // Stopping must end a pending read even if the transport ignores the abort.
        signal.addEventListener("abort", () => void reader.cancel().catch(() => {}), {
          once: true,
        });
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const parsed = parseEventStream(buffer + decoder.decode(value, { stream: true }));
          buffer = parsed.rest;
          for (const data of parsed.events) {
            const event = toLiveEvent(data);
            if (event) onEvent(event);
          }
        }
      } catch {
        /* network drop or abort: handled below */
      }
      if (signal.aborted) return;
      onStatus(false);
      attempt++;
      await wait(retryDelay(attempt));
    }
  })().finally(() => onStatus(false));

  return () => controller.abort();
}
