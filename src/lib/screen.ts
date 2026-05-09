export const SCREENS = [
  { id: "zen", label: "zen" },
  { id: "tabs", label: "tabs hover" },
  { id: "full", label: "full layout" },
  { id: "omnibar", label: "⌘K omnibar" },
  { id: "ai", label: "ai panel" },
  { id: "ghost", label: "ghost suggestion" },
  { id: "error", label: "error banner" },
  { id: "splits", label: "splits" },
  { id: "settings", label: "settings" },
] as const;

export type ScreenId = (typeof SCREENS)[number]["id"];
export type ThemeId = "dark" | "light";

const SCREEN_IDS = new Set(SCREENS.map((s) => s.id));

export function readScreen(): ScreenId {
  const u = new URL(window.location.href);
  const v = u.searchParams.get("screen");
  return SCREEN_IDS.has(v as ScreenId) ? (v as ScreenId) : "zen";
}

/** Dev-only screen switcher overlay. Toggle by appending `?dev=1` to the URL. */
export function isDevModeUI(): boolean {
  const u = new URL(window.location.href);
  return u.searchParams.get("dev") === "1";
}

export function readTheme(): ThemeId {
  const u = new URL(window.location.href);
  return u.searchParams.get("theme") === "light" ? "light" : "dark";
}

export function writeQuery(key: "screen" | "theme", value: string) {
  const u = new URL(window.location.href);
  u.searchParams.set(key, value);
  history.replaceState(null, "", u.toString());
}
