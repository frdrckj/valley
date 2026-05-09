import { create } from "zustand";
import type { Pane } from "@/modules/terminal/lib/splits";
import { newLeaf } from "@/modules/terminal/lib/splits";

export type Tab = {
  id: string;
  kind: "terminal" | "preview";
  cwd?: string;
  label: string;
  panes: Pane;
  /** Preview-tab url. Ignored for terminal tabs. */
  url?: string;
};

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  open(tab: Omit<Tab, "id" | "panes"> & Partial<Pick<Tab, "id">>): string;
  close(id: string): void;
  activate(id: string): void;
  rename(id: string, label: string): void;
  setPanes(id: string, panes: Pane): void;
  setCwd(id: string, cwd: string): void;
  setUrl(id: string, url: string): void;
}

let counter = 0;
const nextId = () => `t${++counter}-${Date.now().toString(36)}`;

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  open(input) {
    const id = input.id ?? nextId();
    const tab: Tab = {
      id,
      kind: input.kind,
      cwd: input.cwd,
      label: input.label,
      panes: newLeaf(`pty-${id}`),
      url: input.url,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: id }));
    return id;
  },
  close(id) {
    const tabs = get().tabs.filter((t) => t.id !== id);
    const activeId =
      get().activeId === id ? (tabs[tabs.length - 1]?.id ?? null) : get().activeId;
    set({ tabs, activeId });
  },
  activate(id) {
    if (get().tabs.some((t) => t.id === id)) set({ activeId: id });
  },
  rename(id, label) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, label } : t)) });
  },
  setPanes(id, panes) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, panes } : t)) });
  },
  setCwd(id, cwd) {
    const t = get().tabs.find((t) => t.id === id);
    if (!t || t.cwd === cwd) return;
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, cwd } : t)) });
  },
  setUrl(id, url) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, url } : t)) });
  },
}));
