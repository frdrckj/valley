/**
 * Ring buffer of recently-opened file paths, persisted via the Tauri Store
 * plugin. Mirrors the pattern in src/modules/tabs/persistence.ts.
 *
 * Capacity: 30 paths. Newest paths appear first.
 */
import { Store } from "@tauri-apps/plugin-store";
import { useTabs } from "@/modules/tabs/useTabs";

const FILE = "valley-recent.json";
const KEY = "paths";
const CAPACITY = 30;

let paths: string[] = [];
let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

/** Load persisted recent paths from disk. Call once at app boot. */
export async function hydrateRecent(): Promise<void> {
  try {
    const store = await getStore();
    const saved = await store.get<string[]>(KEY);
    if (Array.isArray(saved)) paths = saved.slice(0, CAPACITY);
  } catch {
    /* best-effort — leave paths empty */
  }
}

/** Push a file path to the front of the ring buffer and persist. */
export function pushRecent(path: string): void {
  paths = [path, ...paths.filter((p) => p !== path)].slice(0, CAPACITY);
  void persistRecent();
}

async function persistRecent(): Promise<void> {
  try {
    const store = await getStore();
    await store.set(KEY, paths);
    await store.save();
  } catch {
    /* best-effort */
  }
}

/** Return the current recent paths list (newest first). */
export function getRecentPaths(): readonly string[] {
  return paths;
}

/**
 * Subscribe to useTabs and push file-tab paths into the recent buffer.
 * Returns an unsubscribe handle. Call once at app boot.
 */
export function startRecentTracking(): () => void {
  let prevTabs = useTabs.getState().tabs;
  return useTabs.subscribe((s) => {
    const newTabs = s.tabs.filter((t) => {
      const isNew = !prevTabs.some((p) => p.id === t.id);
      return isNew && t.kind === "file" && typeof t.path === "string";
    });
    for (const tab of newTabs) {
      if (tab.path) pushRecent(tab.path);
    }
    prevTabs = s.tabs;
  });
}
