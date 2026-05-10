import { useSyncExternalStore } from "react";

export type Side = "left" | "right";

interface Layout {
  sidebar: Side;
  ai: Side;
  sidebarWidth: number;
  aiWidth: number;
}

const STORAGE_KEY = "valley.layout";
const DEFAULTS: Layout = {
  sidebar: "right",
  ai: "left",
  sidebarWidth: 240,
  aiWidth: 360,
};

const MIN_WIDTH = 160;
const MAX_WIDTH = 560;

function clamp(n: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(n)));
}

function load(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Layout>;
    return {
      sidebar:
        v.sidebar === "left" || v.sidebar === "right"
          ? v.sidebar
          : DEFAULTS.sidebar,
      ai: v.ai === "left" || v.ai === "right" ? v.ai : DEFAULTS.ai,
      sidebarWidth:
        typeof v.sidebarWidth === "number"
          ? clamp(v.sidebarWidth)
          : DEFAULTS.sidebarWidth,
      aiWidth:
        typeof v.aiWidth === "number" ? clamp(v.aiWidth) : DEFAULTS.aiWidth,
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
  const next: Layout = { ...state, ...patch };
  if (typeof patch.sidebarWidth === "number") {
    next.sidebarWidth = clamp(patch.sidebarWidth);
  }
  if (typeof patch.aiWidth === "number") {
    next.aiWidth = clamp(patch.aiWidth);
  }
  state = next;
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
    sidebarWidth: layout.sidebarWidth,
    aiWidth: layout.aiWidth,
    setSidebar: (side: Side) => set({ sidebar: side }),
    setAi: (side: Side) => set({ ai: side }),
    setSidebarWidth: (n: number) => set({ sidebarWidth: n }),
    setAiWidth: (n: number) => set({ aiWidth: n }),
  };
}
