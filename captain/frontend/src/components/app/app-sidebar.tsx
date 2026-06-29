import { Link, useNavigate } from "@tanstack/react-router";
import { Truck, Sun, Moon, Headphones, Star, LogOut, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCaptain } from "@/features/captain/captain-context";
import { clearSession } from "@/lib/account";
import { useSidebar } from "./sidebar-context";
import { NAV_ITEMS } from "./nav-items";
import { OnlineToggle } from "./online-toggle";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/**
 * Persistent left sidebar shown on lg+ screens. Pinned with `sticky` + `self-start`
 * so it stays put on scroll without overlapping content, and collapsible via the
 * shared sidebar context.
 */
export function AppSidebar() {
  const { theme, toggle } = useTheme();
  const { profile } = useCaptain();
  const navigate = useNavigate();
  const { open, toggle: toggleNav } = useSidebar();

  function logout() {
    clearSession();
    navigate({ to: "/" });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col overflow-y-auto border-r border-border bg-card lm-no-scrollbar",
        open ? "lg:flex" : "lg:hidden",
      )}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Truck className="h-5 w-5" />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-foreground">
          Load<span className="text-primary">Mitra</span>
        </span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          Captain
        </span>
        <button
          type="button"
          onClick={toggleNav}
          aria-label="Collapse menu"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4">
        <OnlineToggle size="block" className="h-11 text-sm" />
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-primary" }}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Headphones className="h-5 w-5" /> Help &amp; support
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>

        <Link
          to="/app/account"
          className="mt-2 flex items-center gap-3 rounded-xl border border-border p-2.5 hover:bg-secondary"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
            style={{ background: `hsl(${profile.hue} 60% 45%)` }}
          >
            {initials(profile.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{profile.name}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-current text-savings" /> {profile.rating} · {profile.vehicleNumber}
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" /> Log out
        </button>
      </div>
    </aside>
  );
}
