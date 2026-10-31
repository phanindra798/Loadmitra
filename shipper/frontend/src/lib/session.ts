import { useRef, useSyncExternalStore } from "react";
import { getToken, subscribeSession } from "./api";

const serverSession = () => undefined;

/**
 * The signed-in token plus a React `key` for state that must reset per account.
 *
 * The server renders before it can see the session (undefined), so hydration
 * always starts as a guest. Resolving that first unknown value keeps the key
 * stable: the tree updates in place instead of remounting, which used to drop
 * clicks and repeat requests just after load. Any later change (login, logout,
 * account switch, another tab) gets a new key and resets the state.
 */
export function useSessionKey() {
  const session = useSyncExternalStore<string | null | undefined>(
    subscribeSession,
    getToken,
    serverSession,
  );
  const first = useRef<string | null | undefined>(undefined);
  if (first.current === undefined && session !== undefined) first.current = session;
  const key = session === undefined || session === first.current ? "initial" : (session ?? "guest");
  return { session: session ?? null, key };
}
