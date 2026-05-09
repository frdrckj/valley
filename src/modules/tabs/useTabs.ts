import { create } from "zustand";

export type Tab = {
  id: string;
  kind: "terminal";
  cwd?: string;
  label: string;
};

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  open(tab: Omit<Tab, "id"> & Partial<Pick<Tab, "id">>): string;
  close(id: string): void;
  activate(id: string): void;
  rename(id: string, label: string): void;
}

let counter = 0;
const nextId = () => `t${++counter}-${Date.now().toString(36)}`;

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  open(input) {
    const id = input.id ?? nextId();
    const tab: Tab = { id, kind: input.kind, cwd: input.cwd, label: input.label };
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
}));
