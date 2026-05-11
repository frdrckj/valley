import { create } from "zustand";

interface SnippetPaletteState {
  isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

export const useSnippetPalette = create<SnippetPaletteState>((set) => ({
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
