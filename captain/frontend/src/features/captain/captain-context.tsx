import { toast } from "sonner";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, captainApi, getToken, subscribeSession } from "@/lib/api";
import { isActiveTrip, latestTrip, mergeTrips } from "./trip-record";
import type { CaptainProfile, EarningsSummary, LoadRequest, Trip, TripStatus } from "./types";

const TRIPS_KEY = ["captain-trips"] as const;
const LIST_KEY = [...TRIPS_KEY, "list"] as const;
const detailKey = (id: string) => [...TRIPS_KEY, "detail", id];
const EMPTY_TRIPS: Trip[] = [];
const EMPTY_REQUESTS: LoadRequest[] = [];
const EMPTY_EARNINGS: EarningsSummary = { today: 0, week: 0, month: 0, tripsToday: 0, onlineHoursToday: 0, incentiveThisWeek: 0, acceptanceRate: 0, ledger: [] };
const EMPTY_PROFILE: CaptainProfile = { id: "", name: "Captain", phoneMasked: "", vehicleNumber: "Not registered", truckTypeId: "", rating: 0, trips: 0, joinedLabel: "", hue: 211, kycVerified: false, city: "" };

interface CaptainContextValue {
  authenticated: boolean;
  online: boolean;
  profile: CaptainProfile;
  earnings: EarningsSummary;
  requestPool: LoadRequest[];
  requests: LoadRequest[];
  activeTrip: Trip | null;
  trips: Trip[];
  tripsLoading: boolean;
  tripsError: string | null;
  refreshTrips: () => void;
  setOnline: (online: boolean) => void;
  toggleOnline: () => void;
  setRequests: (requests: LoadRequest[]) => void;
  addRequest: (request: LoadRequest) => void;
  declineRequest: (id: string) => void;
  acceptRequest: (id: string) => Promise<boolean>;
  updateStatus: (status: TripStatus, otp?: string, id?: string) => Promise<boolean>;
  completeTrip: (ratingGiven?: number, otp?: string, id?: string) => Promise<boolean>;
  cancelTrip: (id?: string) => Promise<boolean>;
  getTrip: (id: string) => Trip | undefined;
  refreshProfile: () => void;
}
const CaptainContext = createContext<CaptainContextValue | null>(null);

/** Changing accounts replaces the entire private query cache and local UI state. */
export function CaptainProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getToken, () => null);
  return <CaptainSession key={session ?? "guest"} session={session}>{children}</CaptainSession>;
}
function CaptainSession({ session, children }: { session: string | null; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}><CaptainStore session={session}>{children}</CaptainStore></QueryClientProvider>;
}

function CaptainStore({ session, children }: { session: string | null; children: ReactNode }) {
  const client = useQueryClient();
  const authenticated = Boolean(session);
  const [online, setOnlineState] = useState(false);
  const [requests, setRequests] = useState<LoadRequest[]>([]);
  const [completed, setCompleted] = useState<Trip[]>([]);
  const alive = useRef(true);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; pending.current?.abort(); };
  }, []);
  const currentSession = useCallback(() => alive.current && Boolean(session) && getToken() === session, [session]);

  // Trip recovery does not depend on the profile, earnings or offer endpoints.
  const tripQuery = useQuery({
    queryKey: LIST_KEY, enabled: authenticated,
    queryFn: async ({ signal }) => {
      const incoming = await captainApi.trips(signal);
      return mergeTrips(client.getQueryData<Trip[]>(LIST_KEY) ?? [], incoming);
    },
    refetchInterval: 3000,
  });
  const records = tripQuery.data ?? EMPTY_TRIPS;
  const activeTrip = records.find(isActiveTrip) ?? null;
  const trips = records.filter(trip => !isActiveTrip(trip));
  const tripsLoading = authenticated && tripQuery.isPending;
  const profileQuery = useQuery({ queryKey: ["captain-account"], enabled: authenticated, queryFn: ({ signal }) => api.me(signal), staleTime: 60000 });
  const earningsQuery = useQuery({ queryKey: ["captain-earnings"], enabled: authenticated, queryFn: ({ signal }) => captainApi.earnings(signal), staleTime: Infinity });
  const offersQuery = useQuery({ queryKey: ["captain-offers"], enabled: authenticated && !tripsLoading && !activeTrip,
    queryFn: ({ signal }) => captainApi.requests(signal), refetchInterval: 6000 });
  const requestPool = offersQuery.data ?? EMPTY_REQUESTS;
  const account = profileQuery.data?.user;
  // Vehicle/KYC onboarding is still pending: do not invent an identity from a phone number.
  const profile = account ? { ...EMPTY_PROFILE, id: account.id, name: account.name,
    phoneMasked: account.phone.replace(/.(?=.{4})/g, "•") } : EMPTY_PROFILE;
  const earnings = useMemo(() => {
    const base = earningsQuery.data ?? EMPTY_EARNINGS;
    const net = completed.reduce((sum, trip) => sum + trip.payout.net, 0);
    return { ...base, today: base.today + net, week: base.week + net, month: base.month + net, tripsToday: base.tripsToday + completed.length };
  }, [earningsQuery.data, completed]);

  const refreshTrips = useCallback(() => { void client.invalidateQueries({ queryKey: TRIPS_KEY }); }, [client]);
  const refreshProfile = useCallback(() => { void client.invalidateQueries({ queryKey: ["captain-account"] }); }, [client]);
  const getTrip = useCallback((id: string) => records.find(trip => trip.id === id), [records]);
  const setOnline = useCallback((value: boolean) => { setOnlineState(value); if (!value) setRequests([]); }, []);
  const toggleOnline = useCallback(() => { setOnlineState(value => !value); setRequests([]); }, []);
  const addRequest = useCallback((request: LoadRequest) => { setRequests(current => current.some(item => item.id === request.id) ? current : [request, ...current]); }, []);
  const declineRequest = useCallback((id: string) => { setRequests(current => current.filter(item => item.id !== id)); }, []);

  const mutateTrip = useCallback(async (perform: (signal: AbortSignal) => Promise<Trip>): Promise<boolean> => {
    if (!currentSession() || pending.current) return false;
    const controller = new AbortController(); pending.current = controller;
    try {
      await client.cancelQueries({ queryKey: TRIPS_KEY });
      if (!currentSession()) return false;
      const trip = await perform(controller.signal);
      // Cancel reads started while the mutation was pending before updating both caches.
      await client.cancelQueries({ queryKey: TRIPS_KEY });
      if (!currentSession()) return false;
      client.setQueryData<Trip[]>(LIST_KEY, previous => mergeTrips(previous ?? [], [trip]));
      client.setQueryData<Trip>(detailKey(trip.id), previous => latestTrip(previous, trip));
      setRequests([]);
      if (trip.status === "delivered") setCompleted(previous => previous.some(item => item.id === trip.id) ? previous : [...previous, trip]);
      return true;
    } catch (error) {
      if (currentSession() && !controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : "Trip update failed");
        refreshTrips();
      }
      return false;
    } finally { if (pending.current === controller) pending.current = null; }
  }, [client, currentSession, refreshTrips]);

  const acceptRequest = useCallback(async (id: string) => {
    if (activeTrip || !tripQuery.data || tripQuery.isError) return false;
    return mutateTrip(signal => captainApi.accept(id, signal));
  }, [activeTrip, tripQuery.data, tripQuery.isError, mutateTrip]);
  const updateStatus = useCallback(async (status: TripStatus, otp?: string, id = activeTrip?.id) => {
    if (!id) return false;
    return mutateTrip(signal => captainApi.updateStatus(id, status, otp, signal));
  }, [activeTrip?.id, mutateTrip]);
  const value: CaptainContextValue = {
    authenticated, online, profile, earnings, requestPool,
    requests: activeTrip ? [] : requests.filter(request => requestPool.some(item => item.id === request.id)),
    activeTrip, trips, tripsLoading,
    tripsError: tripQuery.error ? tripQuery.error.message : null,
    refreshTrips, setOnline, toggleOnline, setRequests, addRequest, declineRequest, acceptRequest, updateStatus,
    completeTrip: (_rating, otp, id) => updateStatus("delivered", otp, id),
    cancelTrip: id => updateStatus("cancelled", undefined, id), getTrip, refreshProfile,
  };
  return <CaptainContext.Provider value={value}>{children}</CaptainContext.Provider>;
}

export function useCaptain() {
  const context = useContext(CaptainContext);
  if (!context) throw new Error("useCaptain must be used within <CaptainProvider>");
  return context;
}

/** A direct link reads its own record, including trips older than the history page. */
export function useStoredTrip(id: string) {
  const { authenticated, getTrip } = useCaptain();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: detailKey(id), enabled: authenticated && Boolean(id),
    queryFn: async ({ signal }) => {
      const incoming = await captainApi.trip(id, signal);
      return latestTrip(client.getQueryData<Trip>(detailKey(id)), incoming);
    },
    refetchInterval: query => {
      if (query.state.error instanceof ApiError && [401, 403, 404].includes(query.state.error.status)) return false;
      return query.state.data && !isActiveTrip(query.state.data) ? false : 3000;
    },
  });
  const unavailable = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  const saved = getTrip(id);
  const trip = !authenticated || unavailable ? undefined : query.data ? latestTrip(saved, query.data) : saved;
  return { trip, loading: authenticated && query.isPending && !trip, error: query.error?.message ?? null,
    retry: () => { void query.refetch(); } };
}
