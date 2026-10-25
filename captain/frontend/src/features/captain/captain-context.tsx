import { toast } from "sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProfile, type Profile } from "@/lib/account";
import { captainApi } from "@/lib/api";
import { CAPTAIN, EARNINGS, LOAD_REQUESTS, SAMPLE_TRIPS, captainIdentityFor } from "./mock-data";
import type {
  CaptainProfile,
  EarningsSummary,
  LoadRequest,
  Trip,
  TripStatus,
} from "./types";

/**
 * Holds the captain's live working state: whether they're online, the incoming
 * load requests being broadcast to them, the trip they're currently running,
 * and their completed-trip history. The provider lives in the /app layout route
 * so this state survives every /app/* navigation without a store library.
 * State is in-memory (no persistence) by design for this demo build.
 */

interface State {
  online: boolean;
  profile: CaptainProfile;
  /** Offer pool the dashboard "broadcasts" from (server requests, or mock seed). */
  requestPool: LoadRequest[];
  requests: LoadRequest[];
  activeTrip: Trip | null;
  trips: Trip[];
  /** Baseline earnings (today/week/month) before this session's completed trips. */
  earningsBase: EarningsSummary;
  /** Net ₹ earned + trips completed during this session, for live earnings. */
  sessionEarned: number;
  sessionTrips: number;
}

const initialState: State = {
  online: false,
  profile: CAPTAIN,
  requestPool: [],
  requests: [],
  activeTrip: null,
  trips: [],
  earningsBase: EARNINGS,
  sessionEarned: 0,
  sessionTrips: 0,
};

type Action =
  | { type: "hydrate"; profile: CaptainProfile; requestPool: LoadRequest[]; trips: Trip[]; earnings: EarningsSummary }
  | { type: "setRequestPool"; requestPool: LoadRequest[] }
  | { type: "setOnline"; online: boolean }
  | { type: "setRequests"; requests: LoadRequest[] }
  | { type: "addRequest"; request: LoadRequest }
  | { type: "declineRequest"; id: string }
  | { type: "acceptRequest"; trip: Trip }
  | { type: "updateStatus"; status: TripStatus }
  | { type: "completeTrip"; ratingGiven?: number }
  | { type: "cancelTrip" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      // Seed live state from the server once on load. Leaves session-only fields
      // (online, activeTrip, requests, sessionEarned/Trips) untouched.
      return {
        ...state,
        profile: action.profile,
        requestPool: action.requestPool,
        trips: action.trips.filter(t => ["delivered", "cancelled"].includes(t.status)),
        activeTrip: action.trips.find(t => !["delivered", "cancelled"].includes(t.status)) ?? null,
        earningsBase: action.earnings,
      };
    case "setRequestPool":
      // Live refresh of the offer pool (polled). Touches only the pool, so an
      // in-progress trip / pending offers / session earnings are untouched.
      return { ...state, requestPool: action.requestPool };
    case "setOnline":
      // Going offline clears pending offers (you stop receiving them).
      return { ...state, online: action.online, requests: action.online ? state.requests : [] };
    case "setRequests":
      return { ...state, requests: action.requests };
    case "addRequest":
      if (state.requests.some((r) => r.id === action.request.id)) return state;
      return { ...state, requests: [action.request, ...state.requests] };
    case "declineRequest":
      return { ...state, requests: state.requests.filter((r) => r.id !== action.id) };
    case "acceptRequest": {
      return { ...state, activeTrip: action.trip, requests: [] };
    }
    case "updateStatus": {
      if (!state.activeTrip) return state;
      return { ...state, activeTrip: { ...state.activeTrip, status: action.status } };
    }
    case "completeTrip": {
      if (!state.activeTrip) return state;
      const done: Trip = {
        ...state.activeTrip,
        status: "delivered",
        ratingGiven: action.ratingGiven,
      };
      return {
        ...state,
        activeTrip: null,
        trips: [done, ...state.trips],
        sessionEarned: state.sessionEarned + done.payout.net,
        sessionTrips: state.sessionTrips + 1,
      };
    }
    case "cancelTrip": {
      if (!state.activeTrip) return state;
      const cancelled: Trip = { ...state.activeTrip, status: "cancelled" };
      return { ...state, activeTrip: null, trips: [cancelled, ...state.trips] };
    }
    default:
      return state;
  }
}

interface CaptainContextValue extends State {
  earnings: EarningsSummary;
  setOnline: (online: boolean) => void;
  toggleOnline: () => void;
  setRequests: (requests: LoadRequest[]) => void;
  addRequest: (request: LoadRequest) => void;
  declineRequest: (id: string) => void;
  acceptRequest: (id: string) => Promise<boolean>;
  updateStatus: (status: TripStatus, otp?: string) => void;
  completeTrip: (ratingGiven?: number, otp?: string) => void;
  cancelTrip: () => void;
  getTrip: (id: string) => Trip | undefined;
  /** Re-read the registered name/email from storage (call after editing profile). */
  refreshProfile: () => void;
}

const CaptainContext = createContext<CaptainContextValue | null>(null);

export function CaptainProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Map the signed-in captain (by phone) to a distinct identity from the pool —
  // so different captains show different vehicle/rating/avatar to the shipper,
  // not always the same seed driver. Their registered name still wins.
  const [account, setAccount] = useState<Profile | null>(null);
  const refreshProfile = useCallback(() => {
    fetchProfile().then((p) => setAccount(p));
  }, []);
  useEffect(() => refreshProfile(), [refreshProfile]);
  const profile = account
    ? (() => {
        const base = captainIdentityFor(account.phone);
        return { ...base, name: account.name || base.name };
      })()
    : state.profile;

  // Hydrate live state from the shared API once on load. If the server is
  // unreachable the query just stays empty and the mock seed remains — so the
  // captain app still works standalone/offline.
  const hydratedRef = useRef(false);
  const { data: bootstrap } = useQuery({
    queryKey: ["captain", "bootstrap"],
    queryFn: async () => {
      const [p, requestPool, trips, earnings] = await Promise.all([
        captainApi.profile(),
        captainApi.requests(),
        captainApi.trips(),
        captainApi.earnings(),
      ]);
      return { profile: p, requestPool, trips, earnings };
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!bootstrap || hydratedRef.current) return;
    // Don't overwrite a session already in progress.
    if (state.activeTrip || state.sessionTrips > 0) return;
    hydratedRef.current = true;
    dispatch({ type: "hydrate", ...bootstrap });
  }, [bootstrap, state.activeTrip, state.sessionTrips]);

  // Keep the offer pool fresh: poll the shared API so a load a shipper books
  // *after* this app loaded still shows up (no manual refresh needed). On a
  // failed poll the last good pool stays, so offline/standalone still works.
  const { data: livePool } = useQuery({
    queryKey: ["captain", "requests", "live"],
    queryFn: () => captainApi.requests(),
    refetchInterval: 6000,
    retry: false,
  });
  useEffect(() => {
    if (livePool) dispatch({ type: "setRequestPool", requestPool: livePool });
  }, [livePool]);

  const getTrip = useCallback(
    (id: string) =>
      state.activeTrip?.id === id ? state.activeTrip : state.trips.find((t) => t.id === id),
    [state.activeTrip, state.trips],
  );

  // Earnings stay live: the baseline (from the server, or the mock seed) already
  // includes the day's history, so we layer this session's completed-trip net on
  // top of all three windows.
  const earnings = useMemo<EarningsSummary>(
    () => ({
      ...state.earningsBase,
      today: state.earningsBase.today + state.sessionEarned,
      week: state.earningsBase.week + state.sessionEarned,
      month: state.earningsBase.month + state.sessionEarned,
      tripsToday: state.earningsBase.tripsToday + state.sessionTrips,
    }),
    [state.earningsBase, state.sessionEarned, state.sessionTrips],
  );

  const value = useMemo<CaptainContextValue>(
    () => ({
      ...state,
      profile,
      earnings,
      refreshProfile,
      setOnline: (online) => dispatch({ type: "setOnline", online }),
      toggleOnline: () => dispatch({ type: "setOnline", online: !state.online }),
      setRequests: (requests) => dispatch({ type: "setRequests", requests }),
      addRequest: (request) => dispatch({ type: "addRequest", request }),
      declineRequest: (id) => dispatch({ type: "declineRequest", id }),
      acceptRequest: async (id) => {
        if (state.activeTrip) return false;
        try {
          const trip = await captainApi.accept(id);
          dispatch({ type: "acceptRequest", trip });
          return true;
        } catch (error) { toast.error(error instanceof Error ? error.message : "Acceptance failed"); return false; }
      },
      updateStatus: async (status, otp) => {
        if (!state.activeTrip) return;
        try {
          await captainApi.updateStatus(state.activeTrip.id, status, otp);
          dispatch({ type: "updateStatus", status });
        } catch (error) { toast.error(error instanceof Error ? error.message : "Status update failed"); }
      },
      completeTrip: async (ratingGiven, otp) => {
        if (!state.activeTrip) return;
        try {
          await captainApi.updateStatus(state.activeTrip.id, "delivered", otp);
          dispatch({ type: "completeTrip", ratingGiven });
        } catch (error) { toast.error(error instanceof Error ? error.message : "Delivery failed"); }
      },
      cancelTrip: async () => {
        if (!state.activeTrip) return;
        try {
          await captainApi.updateStatus(state.activeTrip.id, "cancelled");
          dispatch({ type: "cancelTrip" });
        } catch (error) { toast.error(error instanceof Error ? error.message : "Cancellation failed"); }
      },
      getTrip,
    }),
    [state, profile, earnings, refreshProfile, getTrip],
  );

  return <CaptainContext.Provider value={value}>{children}</CaptainContext.Provider>;
}

export function useCaptain() {
  const ctx = useContext(CaptainContext);
  if (!ctx) throw new Error("useCaptain must be used within <CaptainProvider>");
  return ctx;
}
