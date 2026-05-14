"use client";

import { create } from "zustand";

export type ItemDrawerTab = "updates" | "files" | "activity";

type State = {
  openItemId: string | null;
  activeTab: ItemDrawerTab;
  open: (taskId: string, tab?: ItemDrawerTab) => void;
  close: () => void;
  setActiveTab: (tab: ItemDrawerTab) => void;
  reset: () => void;
};

export const useItemDrawerStore = create<State>((set) => ({
  openItemId: null,
  activeTab: "updates",
  open: (taskId, tab = "updates") => set({ openItemId: taskId, activeTab: tab }),
  close: () => set({ openItemId: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  reset: () => set({ openItemId: null, activeTab: "updates" }),
}));
