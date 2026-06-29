import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useT } from "@/features/shipper/i18n";
import { NAV_ITEMS } from "./nav-items";

/**
 * Mobile bottom tab bar (hidden on lg+). A center "Book" action floats above
 * the bar, Rapido-style, splitting the four primary tabs two-and-two.
 */
export function BottomNav() {
  const t = useT();
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex h-16 max-w-md items-stretch justify-between px-2">
        {left.map((item) => (
          <NavTab key={item.to} item={item} />
        ))}

        {/* Center floating Book button */}
        <div className="relative flex w-16 shrink-0 items-center justify-center">
          <Link
            to="/app/search"
            aria-label={t("nav.book")}
            className="absolute -top-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>

        {right.map((item) => (
          <NavTab key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({ item }: { item: (typeof NAV_ITEMS)[number] }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
      activeProps={{ className: "text-primary" }}
    >
      <Icon className="h-5 w-5" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}
