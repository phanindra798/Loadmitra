import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ApiError, getToken, shipperApi, subscribeSession } from "@/lib/api";
import { mergeBookings } from "./booking-record";
import type {
  Booking,
  BookingDraft,
  BookingMode,
  Place,
} from "./types";

/**
 * Holds the in-progress booking "draft" the user assembles across the flow
 * (home → search → quote → matching → track) plus the list of bookings. The
 * provider lives in the /app layout route, so it stays mounted across all
 * /app/* navigations and the draft survives screen-to-screen without a store
 * library. Saved bookings are recovered from the owner-scoped API. Only the
 * unfinished draft remains in memory; booking data is never stored in cookies.
 */

interface State {
  draft: BookingDraft;
  bookings: Booking[];
}

const initialDraft: BookingDraft = {
  mode: "full",
  loadWeightKg: 500,
  goodsType: "General goods",
};

const initialState: State = {
  draft: initialDraft,
  bookings: [],
};

type Action =
  | { type: "setMode"; mode: BookingMode }
  | { type: "setPickup"; place: Place }
  | { type: "setDrop"; place: Place }
  | { type: "swapStops" }
  | { type: "setTruck"; truckTypeId: string }
  | { type: "setWeight"; loadWeightKg: number }
  | { type: "setGoods"; goodsType: string }
  | { type: "resetDraft" }
  | { type: "restoreBookings"; bookings: Booking[] }
  | { type: "clearBookings" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setMode":
      return { ...state, draft: { ...state.draft, mode: action.mode } };
    case "setPickup":
      return { ...state, draft: { ...state.draft, pickup: action.place } };
    case "setDrop":
      return { ...state, draft: { ...state.draft, drop: action.place } };
    case "swapStops":
      return {
        ...state,
        draft: { ...state.draft, pickup: state.draft.drop, drop: state.draft.pickup },
      };
    case "setTruck":
      return { ...state, draft: { ...state.draft, truckTypeId: action.truckTypeId } };
    case "setWeight":
      return { ...state, draft: { ...state.draft, loadWeightKg: action.loadWeightKg } };
    case "setGoods":
      return { ...state, draft: { ...state.draft, goodsType: action.goodsType } };
    case "resetDraft":
      return { ...state, draft: initialDraft };
    case "restoreBookings":
      return { ...state, bookings: mergeBookings(state.bookings, action.bookings) };
    case "clearBookings":
      return { ...state, bookings: [] };
    default:
      return state;
  }
}

interface BookingContextValue extends State {
  authenticated: boolean;
  historyLoading: boolean;
  historyError: string | null;
  hasMoreBookings: boolean;
  refreshBookings: () => Promise<void>;
  loadMoreBookings: () => Promise<void>;
  storeBooking: (booking: Booking) => void;
  setMode: (mode: BookingMode) => void;
  setPickup: (place: Place) => void;
  setDrop: (place: Place) => void;
  swapStops: () => void;
  setTruck: (truckTypeId: string) => void;
  setWeight: (loadWeightKg: number) => void;
  setGoods: (goodsType: string) => void;
  resetDraft: () => void;
  createBooking: (booking: Booking) => void;
  getBooking: (id: string) => Booking | undefined;
}

const BookingContext = createContext<BookingContextValue | null>(null);

const serverSession = () => null;

export function BookingProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getToken, serverSession);
  // Changing or clearing a session remounts all booking state and cancels its
  // pending requests. No history is reused for a different signed-in account.
  return <BookingStore key={session ?? "guest"} authenticated={Boolean(session)}>{children}</BookingStore>;
}

function BookingStore({ children, authenticated }: { children: ReactNode; authenticated: boolean }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [historyLoading, setHistoryLoading] = useState(authenticated);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const historyRequest = useRef<AbortController | null>(null);
  const storeBooking = useCallback((booking: Booking) => {
    dispatch({ type: "restoreBookings", bookings: [booking] });
  }, []);
  const load = useCallback(async (before?: string) => {
    if (!authenticated) return;
    historyRequest.current?.abort();
    const controller = new AbortController();
    historyRequest.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const page = await shipperApi.listBookings(before, controller.signal);
      if (controller.signal.aborted) return;
      dispatch({ type: "restoreBookings", bookings: page.bookings });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        dispatch({ type: "clearBookings" });
        setNextCursor(null);
      }
      setHistoryError(error instanceof Error ? error.message : "Could not load your bookings");
    } finally {
      if (!controller.signal.aborted) setHistoryLoading(false);
    }
  }, [authenticated]);
  const refreshBookings = useCallback(() => load(), [load]);
  const loadMoreBookings = useCallback(async () => {
    if (nextCursor && !historyLoading) await load(nextCursor);
  }, [nextCursor, historyLoading, load]);
  useEffect(() => {
    void refreshBookings();
    return () => historyRequest.current?.abort();
  }, [refreshBookings]);

  const getBooking = useCallback(
    (id: string) => state.bookings.find((b) => b.id === id),
    [state.bookings],
  );

  const value = useMemo<BookingContextValue>(
    () => ({
      ...state,
      authenticated, historyLoading, historyError, hasMoreBookings: nextCursor !== null,
      refreshBookings, loadMoreBookings, storeBooking,
      setMode: (mode) => dispatch({ type: "setMode", mode }),
      setPickup: (place) => dispatch({ type: "setPickup", place }),
      setDrop: (place) => dispatch({ type: "setDrop", place }),
      swapStops: () => dispatch({ type: "swapStops" }),
      setTruck: (truckTypeId) => dispatch({ type: "setTruck", truckTypeId }),
      setWeight: (loadWeightKg) => dispatch({ type: "setWeight", loadWeightKg }),
      setGoods: (goodsType) => dispatch({ type: "setGoods", goodsType }),
      resetDraft: () => dispatch({ type: "resetDraft" }),
      createBooking: storeBooking,
      getBooking,
    }),
    [state, getBooking, authenticated, historyLoading, historyError, nextCursor, refreshBookings, loadMoreBookings, storeBooking],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within <BookingProvider>");
  return ctx;
}

/** Direct links load their own record, even when it is outside the current history page. */
export function useStoredBooking(id: string) {
  const { getBooking, storeBooking, authenticated } = useBooking();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ id, loading: true, error: null as string | null, unavailable: false });
  const retry = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    if (!id || !authenticated) {
      setResult({ id, loading: false, error: !authenticated ? "Please sign in to view this booking." : "No booking selected.", unavailable: true });
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setResult({ id, loading: true, error: null, unavailable: false });
    async function poll() {
      let again = true;
      try {
        const booking = await shipperApi.getBooking(id, controller.signal);
        if (controller.signal.aborted) return;
        storeBooking(booking);
        setResult({ id, loading: false, error: null, unavailable: false });
        again = booking.status !== "delivered" && booking.status !== "cancelled";
      } catch (error) {
        if (controller.signal.aborted) return;
        const unavailable = error instanceof ApiError && [401, 403, 404].includes(error.status);
        setResult({ id, loading: false, error: error instanceof Error ? error.message : "Could not load booking", unavailable });
        again = !unavailable;
      }
      if (again && !controller.signal.aborted) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, authenticated, revision, storeBooking]);
  return {
    booking: result.id === id && result.unavailable ? undefined : getBooking(id),
    loading: result.id !== id || result.loading,
    error: result.id === id ? result.error : null,
    retry,
  };
}

/** Generate a human booking id. Call only from event handlers (client-side). */
export function newBookingId(): string {
  return "LM-" + crypto.randomUUID().toUpperCase();
}

/** Format a "now" timestamp for booking creation. Event-handler use only. */
export function nowLabel(): string {
  const d = new Date();
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
