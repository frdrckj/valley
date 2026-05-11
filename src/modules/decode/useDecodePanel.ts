import { create } from "zustand";

interface DecodePanelState {
  isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

export const useDecodePanel = create<DecodePanelState>((set) => ({
  isOpen: false,
  open() {
    set({ isOpen: true });
  },
  close() {
    set({ isOpen: false });
  },
  toggle() {
    set((s) => ({ isOpen: !s.isOpen }));
  },
}));
