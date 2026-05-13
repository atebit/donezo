"use client";

import { create } from "zustand";

type SidebarState = {
  collapsed: boolean;
  search: string;
  mobileSidebarOpen: boolean;
  setCollapsed: (v: boolean) => void;
  setSearch: (v: string) => void;
  setMobileSidebarOpen: (open: boolean) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  search: "",
  mobileSidebarOpen: false,
  setCollapsed: (v) => set({ collapsed: v }),
  setSearch: (v) => set({ search: v }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
