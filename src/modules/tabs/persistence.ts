import { Store } from "@tauri-apps/plugin-store";
import { useTabs, type Tab } from "./useTabs";

const FILE = "valley-tabs.json";
const KEY = "tabs";
const ACTIVE_KEY = "activeId";

/**
 * Subset of Tab we persist. Each terminal-kind tab gets a fresh PTY
 * sessionId on restore so we don't try to attach to a zombie pty.
 */
interface PersistedTab {
  id: string;
  kind: Tab["kind"];
  label: string;
  cwd?: string;
  url?: string;
  path?: string;
  userRenamed?: boolean;
  diffMode?: "working" | "staged";
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
    path: t.path,
    userRenamed: t.userRenamed,
    diffMode: t.diffMode,
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
 * Terminal tabs are regenerated with fresh PTY sessionIds so they're
 * live shells, not zombies of the previous session.
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
  // Drop file/diff tabs missing a `path`. Older persisted data didn't carry
  // it; restoring those tabs leads to ENOENT on first read.
  persisted = persisted.filter(
    (p) =>
      (p.kind !== "file" && p.kind !== "diff") ||
      (typeof p.path === "string" && p.path.length > 0),
  );
  if (persisted.length === 0) return false;

  const restored: Tab[] = persisted.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    cwd: p.cwd,
    url: p.url,
    path: p.path,
    userRenamed: p.userRenamed,
    diffMode: p.diffMode,
    sessionId: `pty-${p.id}`,
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
    if (s.tabs !== prevTabs || s.activeId !== prevActive) {
      prevTabs = s.tabs;
      prevActive = s.activeId;
      schedulePersist();
    }
  });
}
