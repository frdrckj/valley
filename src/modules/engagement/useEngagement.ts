import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";

export interface Engagement {
  id: string;
  name: string;
  scope: string[];
  rootDir: string;
  notes: string;
  createdMs: number;
  updatedMs: number;
}

interface EngagementState {
  engagements: Engagement[];
  activeId: string | null;
  active: () => Engagement | null;
  create(input: Pick<Engagement, "name" | "scope" | "rootDir">): Promise<Engagement>;
  update(id: string, patch: Partial<Engagement>): Promise<void>;
  setActive(id: string | null): Promise<void>;
  remove(id: string): Promise<void>;
}

const FILE = "valley-engagements.json";
const KEY = "engagements";
const ACTIVE_KEY = "activeId";

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

async function persistNow(): Promise<void> {
  const { engagements, activeId } = useEngagement.getState();
  try {
    const store = await getStore();
    await store.set(KEY, engagements);
    await store.set(ACTIVE_KEY, activeId);
    await store.save();
  } catch {
    /* best-effort */
  }
}

let _idCounter = 0;
function genId(): string {
  return `eng-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

export const useEngagement = create<EngagementState>((set, get) => ({
  engagements: [],
  activeId: null,

  active() {
    const { engagements, activeId } = get();
    return engagements.find((e) => e.id === activeId) ?? null;
  },

  async create(input) {
    const now = Date.now();
    const eng: Engagement = {
      id: genId(),
      name: input.name,
      scope: input.scope,
      rootDir: input.rootDir,
      notes: "",
      createdMs: now,
      updatedMs: now,
    };
    set((s) => ({
      engagements: [eng, ...s.engagements],
      activeId: eng.id,
    }));
    await persistNow();
    return eng;
  },

  async update(id, patch) {
    set((s) => ({
      engagements: s.engagements.map((e) =>
        e.id === id ? { ...e, ...patch, updatedMs: Date.now() } : e,
      ),
    }));
    await persistNow();
  },

  async setActive(id) {
    set({ activeId: id });
    await persistNow();
  },

  async remove(id) {
    set((s) => ({
      engagements: s.engagements.filter((e) => e.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
    await persistNow();
  },
}));

export async function hydrateEngagements(): Promise<void> {
  try {
    const store = await getStore();
    const engagements = (await store.get<Engagement[]>(KEY)) ?? [];
    const activeId = (await store.get<string | null>(ACTIVE_KEY)) ?? null;
    useEngagement.setState({
      engagements,
      activeId:
        activeId && engagements.some((e) => e.id === activeId) ? activeId : null,
    });
  } catch {
    /* best-effort; leave defaults */
  }
}
