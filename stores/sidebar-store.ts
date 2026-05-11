"use client";

import { create } from "zustand";

type SidebarState = {
  collapsed: boolean;
  search: string;
  setCollapsed: (v: boolean) => void;
  setSearch: (v: string) => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  search: "",
  setCollapsed: (v) => set({ collapsed: v }),
  setSearch: (v) => set({ search: v }),
}));
