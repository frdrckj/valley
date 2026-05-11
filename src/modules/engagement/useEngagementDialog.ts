import { create } from "zustand";

export type DialogMode = "closed" | "new" | "switch" | "edit";

interface EngagementDialogState {
  mode: DialogMode;
  open(mode: Exclude<DialogMode, "closed">): void;
  close(): void;
}

export const useEngagementDialog = create<EngagementDialogState>((set) => ({
  mode: "closed",
  open(mode) {
    set({ mode });
  },
  close() {
    set({ mode: "closed" });
  },
}));
