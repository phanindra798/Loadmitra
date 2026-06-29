import { LayoutDashboard, Route as RouteIcon, Wallet, User, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/** Primary navigation shared by the desktop sidebar and the mobile bottom bar. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/trips", label: "Trips", icon: RouteIcon },
  { to: "/app/earnings", label: "Earnings", icon: Wallet },
  { to: "/app/account", label: "Account", icon: User },
];
