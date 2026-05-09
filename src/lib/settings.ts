import { Store } from "@tauri-apps/plugin-store";
import { useSyncExternalStore } from "react";

const FILE = "valley-settings.json";

export interface Settings {
  theme: "dark" | "light" | "auto";
  vibrancy: boolean;
  ligatures: boolean;
  defaultProvider: "openai" | "anthropic";
  defaultModel: string;
  autoApproveReadTools: boolean;
  showHiddenFiles: boolean;
}

const DEFAULTS: Settings = {
  theme: "dark",
  vibrancy: true,
  ligatures: false,
  defaultProvider: "anthropic",
  defaultModel: "claude-haiku-4-5-20251001",
  autoApproveReadTools: true,
  showHiddenFiles: false,
};

let cached: Settings = DEFAULTS;
let storePromise: Promise<Store> | null = null;
const listeners = new Set<() => void>();

function getStore() {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

export async function hydrateSettings() {
  const store = await getStore();
  const v = (await store.get<Settings>("settings")) ?? DEFAULTS;
  cached = { ...DEFAULTS, ...v };
  listeners.forEach((l) => l());
}

export async function patchSettings(patch: Partial<Settings>) {
  cached = { ...cached, ...patch };
  const store = await getStore();
  await store.set("settings", cached);
  await store.save();
  listeners.forEach((l) => l());
}

export function getSettingsSnapshot(): Settings {
  return cached;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    () => cached,
    () => cached,
  );
}
