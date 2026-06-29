import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchProfile, type Profile } from "@/lib/account";

/**
 * The signed-in shipper's identity, shared across the whole app shell so the
 * greeting, sidebar, avatar and account screen all show the *registered* name
 * from the database. Hydrated from `GET /api/auth/me` on mount; `setProfile`
 * lets edits update every surface live.
 */
interface ProfileCtx {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  displayName: string;
  firstName: string;
  initials: string;
}

function computeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

const ProfileContext = createContext<ProfileCtx>({
  profile: null,
  setProfile: () => {},
  displayName: "Guest",
  firstName: "there",
  initials: "U",
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let alive = true;
    fetchProfile().then((p) => {
      if (alive) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<ProfileCtx>(() => {
    const displayName = profile?.name || "Guest";
    return {
      profile,
      setProfile,
      displayName,
      firstName: profile?.name?.trim().split(/\s+/)[0] || "there",
      initials: computeInitials(displayName),
    };
  }, [profile]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
