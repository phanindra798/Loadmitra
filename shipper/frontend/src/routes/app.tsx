import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BookingProvider } from "@/features/shipper/booking-context";
import { ProfileProvider } from "@/features/shipper/profile-context";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { SidebarContext } from "@/components/app/sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "LoadMitra — Book a truck" }],
  }),
  component: AppLayout,
});

/**
 * Shipper app shell. Providers live here so the booking draft and language
 * preference persist across every /app/* navigation (the layout stays mounted).
 * Responsive: persistent (collapsible) sidebar on lg+, floating bottom tab bar below.
 */
function AppLayout() {
  const [navOpen, setNavOpen] = usePersistedState("lm-sidebar-open", true);
  const toggle = () => setNavOpen((o) => !o);

  return (
    <ProfileProvider>
    <BookingProvider>
      <SidebarContext.Provider value={{ open: navOpen, toggle }}>
        <div className="min-h-[100dvh] bg-background">
          <AppSidebar />
          {/* Margin (not padding) so the absolutely-positioned map panels start after the sidebar. */}
          <main className={cn("relative min-w-0", navOpen && "lg:ml-[260px]")}>
            {/* Reopen the collapsed sidebar (desktop only). */}
            {!navOpen && (
              <button
                type="button"
                onClick={toggle}
                aria-label="Open menu"
                className="fixed left-3 top-3 z-50 hidden h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm backdrop-blur hover:bg-secondary lg:grid"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            )}
            <Outlet />
          </main>
          <BottomNav />
          <Toaster position="top-center" richColors />
        </div>
      </SidebarContext.Provider>
    </BookingProvider>
    </ProfileProvider>
  );
}
