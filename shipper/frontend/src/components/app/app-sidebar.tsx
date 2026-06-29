import { Link, useNavigate } from "@tanstack/react-router";
import { Truck, Plus, Sun, Moon, Headphones, LogOut, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/features/shipper/i18n";
import { useProfile } from "@/features/shipper/profile-context";
import { clearSession } from "@/lib/account";
import { useSidebar } from "./sidebar-context";
import { NAV_ITEMS } from "./nav-items";

/**
 * Persistent left sidebar shown on lg+ screens. Pinned with `sticky` + `self-start`
 * so it stays put on scroll without overlapping content, and collapsible via the
 * shared sidebar context (the header button closes it; a floating button reopens it).
 */
export function AppSidebar() {
  const { theme, toggle } = useTheme();
  const t = useT();
  const navigate = useNavigate();
  const { open, toggle: toggleNav } = useSidebar();
  const { displayName, initials } = useProfile();

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
        <button
          type="button"
          onClick={toggleNav}
          aria-label="Collapse menu"
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4">
        <Link
          to="/app/search"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> {t("nav.book")}
        </Link>
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
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Headphones className="h-5 w-5" /> {t("nav.help")}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
        </button>

        <Link
          to="/app/account"
          className="mt-2 flex items-center gap-3 rounded-xl border border-border p-2.5 hover:bg-secondary"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
            <span className="block truncate text-xs text-muted-foreground">{t("common.shipperAccount")}</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" /> {t("account.logout")}
        </button>
      </div>
    </aside>
  );
}
