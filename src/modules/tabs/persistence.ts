import { Store } from "@tauri-apps/plugin-store";
import { newLeaf } from "@/modules/terminal/lib/splits";
import { useTabs, type Tab } from "./useTabs";

const FILE = "valley-tabs.json";
const KEY = "tabs";
const ACTIVE_KEY = "activeId";

/**
 * Subset of Tab we persist. Panes are runtime-only — every restored tab
 * starts as a single fresh pane with a new PTY session, regardless of
 * the splits the user had open. Restoring split layouts is Phase 2 work
 * and would require persisting per-pane state more carefully.
 */
interface PersistedTab {
  id: string;
  kind: Tab["kind"];
  label: string;
  cwd?: string;
  url?: string;
  userRenamed?: boolean;
}

let storePromise: Promise<Store> | null = null;
function getStore() {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, 200);
}

async function persistNow() {
  const { tabs, activeId } = useTabs.getState();
  const persisted: PersistedTab[] = tabs.map((t) => ({
    id: t.id,
    kind: t.kind,
    label: t.label,
    cwd: t.cwd,
    url: t.url,
    userRenamed: t.userRenamed,
  }));
  try {
    const store = await getStore();
    await store.set(KEY, persisted);
    await store.set(ACTIVE_KEY, activeId);
    await store.save();
  } catch {
    /* persistence is best-effort; keep going */
  }
}

/**
 * Restore tabs from disk. Returns true if at least one tab was restored.
 * Panes are regenerated from fresh PTY sessionIds so restored terminals
 * are live shells, not zombies of the previous session.
 */
export async function hydrateTabs(): Promise<boolean> {
  let persisted: PersistedTab[] = [];
  let activeId: string | null = null;
  try {
    const store = await getStore();
    persisted = (await store.get<PersistedTab[]>(KEY)) ?? [];
    activeId = (await store.get<string | null>(ACTIVE_KEY)) ?? null;
  } catch {
    return false;
  }
  if (persisted.length === 0) return false;

  const restored: Tab[] = persisted.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    cwd: p.cwd,
    url: p.url,
    userRenamed: p.userRenamed,
    panes: newLeaf(`pty-${p.id}`),
  }));

  useTabs.setState({
    tabs: restored,
    activeId:
      activeId && restored.some((t) => t.id === activeId)
        ? activeId
        : (restored[0]?.id ?? null),
  });
  return true;
}

/**
 * Subscribe to useTabs and write changes through to disk (debounced).
 * Call once at app boot. Returns an unsubscribe handle for cleanup.
 */
export function startTabsPersistence() {
  let prevTabs = useTabs.getState().tabs;
  let prevActive = useTabs.getState().activeId;
  return useTabs.subscribe((s) => {
    // Persist on tab list changes OR active-id changes — skip pane edits
    // since panes aren't persisted.
    if (s.tabs !== prevTabs || s.activeId !== prevActive) {
      prevTabs = s.tabs;
      prevActive = s.activeId;
      schedulePersist();
    }
  });
}
