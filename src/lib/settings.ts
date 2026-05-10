import { Store } from "@tauri-apps/plugin-store";
import { useSyncExternalStore } from "react";
import type { ThemeId } from "@/modules/theme/themes";

const FILE = "valley-settings.json";

export type ThemeSetting = "auto" | ThemeId;

export interface Settings {
  theme: ThemeSetting;
  vibrancy: boolean;
  ligatures: boolean;
  /** Terminal font size in pixels. xterm + the editor both follow it. */
  terminalFontSize: number;
  defaultProvider: "openai" | "anthropic";
  defaultModel: string;
  autoApproveReadTools: boolean;
  showHiddenFiles: boolean;
}

const DEFAULTS: Settings = {
  theme: "gruvbox-material-dark",
  vibrancy: true,
  ligatures: false,
  terminalFontSize: 17,
  defaultProvider: "anthropic",
  defaultModel: "claude-haiku-4-5-20251001",
  autoApproveReadTools: true,
  showHiddenFiles: false,
};

/**
 * Migrate legacy persisted theme values. Earlier valley builds saved
 * `"dark" | "light"`; we now save the concrete theme id. Map them so
 * existing users don't see a surprise reset on first launch after the
 * upgrade.
 */
function migrate(v: Record<string, unknown>): Partial<Settings> {
  const legacy = v.theme;
  const out = { ...v } as Partial<Settings>;
  if (legacy === "dark") out.theme = "gruvbox-material-dark";
  else if (legacy === "light") out.theme = "gruvbox-light-hard";
  return out;
}

let cached: Settings = DEFAULTS;
let storePromise: Promise<Store> | null = null;
const listeners = new Set<() => void>();

function getStore() {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

export async function hydrateSettings() {
  const store = await getStore();
  const raw = (await store.get<Partial<Settings>>("settings")) ?? {};
  cached = { ...DEFAULTS, ...migrate(raw) };
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
