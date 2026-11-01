import { useEffect, useRef, useState } from "react";
import { LIVE_EVENTS_URL } from "./api";
import { startLiveEvents, type LiveEvent } from "./live";

/**
 * Listens for live change signals while `token` is set and returns whether the
 * stream is connected, so callers can slow their fallback polling.
 *
 * The stream is closed while the tab is hidden and when the page is left.
 * Browsers allow only six HTTP/1.1 connections per server, and a stream left
 * open by a previous page or a background tab would hold one of them; once
 * they are all taken, every other API call waits. Coming back reconnects and
 * resyncs, since signals may have been missed meanwhile.
 */
export function useLiveEvents(token: string | null, onEvent: (event: LiveEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!token || typeof window === "undefined") return;
    let stop: (() => void) | null = null;
    let generation = 0;
    let started = false;
    const start = () => {
      if (stop || document.visibilityState === "hidden") return;
      const current = ++generation;
      // A stopped stream may report after the next one started; ignore it.
      const isCurrent = () => current === generation;
      stop = startLiveEvents({
        url: LIVE_EVENTS_URL,
        token,
        resumed: started,
        onEvent: (event) => {
          if (isCurrent()) handler.current(event);
        },
        onStatus: (value) => {
          if (isCurrent()) setConnected(value);
        },
      });
      started = true;
    };
    const halt = () => {
      generation++;
      stop?.();
      stop = null;
      setConnected(false);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? halt() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", halt);
    window.addEventListener("pageshow", start);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", halt);
      window.removeEventListener("pageshow", start);
      halt();
    };
  }, [token]);
  return connected;
}
