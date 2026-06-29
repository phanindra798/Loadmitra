import { createContext, useContext } from "react";

/** Desktop sidebar open/collapsed state, shared by the layout, the sidebar, and page headers. */
export interface SidebarCtx {
  open: boolean;
  toggle: () => void;
}

export const SidebarContext = createContext<SidebarCtx>({ open: true, toggle: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}
