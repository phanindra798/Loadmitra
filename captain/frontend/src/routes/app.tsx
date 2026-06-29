import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CaptainProvider } from "@/features/captain/captain-context";
import { LanguageProvider } from "@/features/captain/i18n";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { SidebarContext } from "@/components/app/sidebar-context";
import { usePersistedState } from "@/hooks/use-persisted-state";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "LoadMitra Captain — Dashboard" }],
  }),
  component: AppLayout,
});

/**
 * Captain app shell. Providers live here so the online status, active trip, and
 * language preference persist across every /app/* navigation (the layout stays
 * mounted). Responsive: persistent sidebar on lg+, floating bottom tab bar below.
 */
function AppLayout() {
  const [navOpen, setNavOpen] = usePersistedState("lm-sidebar-open", true);
  const toggle = () => setNavOpen((o) => !o);

  return (
    <LanguageProvider>
      <CaptainProvider>
        <SidebarContext.Provider value={{ open: navOpen, toggle }}>
          <div className="min-h-[100dvh] bg-background">
            <AppSidebar />
            <main className={cn("relative min-w-0", navOpen && "lg:ml-[260px]")}>
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
      </CaptainProvider>
    </LanguageProvider>
  );
}
