import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { SAMPLE_BOOKINGS } from "./mock-data";
import type {
  Booking,
  BookingDraft,
  BookingMode,
  BookingStatus,
  Captain,
  Place,
} from "./types";

/**
 * Holds the in-progress booking "draft" the user assembles across the flow
 * (home → search → quote → matching → track) plus the list of bookings. The
 * provider lives in the /app layout route, so it stays mounted across all
 * /app/* navigations and the draft survives screen-to-screen without a store
 * library. State is in-memory (no persistence) by design for this demo build.
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
  bookings: SAMPLE_BOOKINGS,
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
  | { type: "createBooking"; booking: Booking }
  | { type: "updateBooking"; id: string; patch: Partial<Booking> };

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
    case "createBooking":
      return { ...state, bookings: [action.booking, ...state.bookings] };
    case "updateBooking":
      return {
        ...state,
        bookings: state.bookings.map((b) =>
          b.id === action.id ? { ...b, ...action.patch } : b,
        ),
      };
    default:
      return state;
  }
}

interface BookingContextValue extends State {
  setMode: (mode: BookingMode) => void;
  setPickup: (place: Place) => void;
  setDrop: (place: Place) => void;
  swapStops: () => void;
  setTruck: (truckTypeId: string) => void;
  setWeight: (loadWeightKg: number) => void;
  setGoods: (goodsType: string) => void;
  resetDraft: () => void;
  createBooking: (booking: Booking) => void;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  updateStatus: (id: string, status: BookingStatus) => void;
  assignCaptain: (id: string, captain: Captain) => void;
  getBooking: (id: string) => Booking | undefined;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const getBooking = useCallback(
    (id: string) => state.bookings.find((b) => b.id === id),
    [state.bookings],
  );

  const value = useMemo<BookingContextValue>(
    () => ({
      ...state,
      setMode: (mode) => dispatch({ type: "setMode", mode }),
      setPickup: (place) => dispatch({ type: "setPickup", place }),
      setDrop: (place) => dispatch({ type: "setDrop", place }),
      swapStops: () => dispatch({ type: "swapStops" }),
      setTruck: (truckTypeId) => dispatch({ type: "setTruck", truckTypeId }),
      setWeight: (loadWeightKg) => dispatch({ type: "setWeight", loadWeightKg }),
      setGoods: (goodsType) => dispatch({ type: "setGoods", goodsType }),
      resetDraft: () => dispatch({ type: "resetDraft" }),
      createBooking: (booking) => dispatch({ type: "createBooking", booking }),
      updateBooking: (id, patch) => dispatch({ type: "updateBooking", id, patch }),
      updateStatus: (id, status) => dispatch({ type: "updateBooking", id, patch: { status } }),
      assignCaptain: (id, captain) => dispatch({ type: "updateBooking", id, patch: { captain } }),
      getBooking,
    }),
    [state, getBooking],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within <BookingProvider>");
  return ctx;
}

/** Generate a human booking id. Call only from event handlers (client-side). */
export function newBookingId(): string {
  return "LM-" + Date.now().toString(36).slice(-6).toUpperCase();
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
