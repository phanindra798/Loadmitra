import { Home, Package, BadgePercent, User, type LucideIcon } from "lucide-react";
import type { TKey } from "@/features/shipper/translations";

export interface NavItem {
  to: string;
  labelKey: TKey;
  icon: LucideIcon;
  exact?: boolean;
}

/** Primary navigation shared by the desktop sidebar and the mobile bottom bar. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/app", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/app/bookings", labelKey: "nav.bookings", icon: Package },
  { to: "/app/offers", labelKey: "nav.offers", icon: BadgePercent },
  { to: "/app/account", labelKey: "nav.account", icon: User },
];
