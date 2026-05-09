import { useSyncExternalStore } from "react";

export type Side = "left" | "right";

interface Layout {
  sidebar: Side;
  ai: Side;
}

const STORAGE_KEY = "valley.layout";
const DEFAULTS: Layout = { sidebar: "right", ai: "left" };

function load(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Layout>;
    return {
      sidebar: v.sidebar === "left" || v.sidebar === "right" ? v.sidebar : DEFAULTS.sidebar,
      ai: v.ai === "left" || v.ai === "right" ? v.ai : DEFAULTS.ai,
    };
  } catch {
    return DEFAULTS;
  }
}

let state: Layout = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Layout {
  return state;
}

function set(patch: Partial<Layout>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage may be blocked — ignore */
  }
  listeners.forEach((l) => l());
}

export function useLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    sidebar: layout.sidebar,
    ai: layout.ai,
    setSidebar: (side: Side) => set({ sidebar: side }),
    setAi: (side: Side) => set({ ai: side }),
  };
}
