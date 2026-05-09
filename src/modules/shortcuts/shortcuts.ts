export type ShortcutGroup = "general" | "tabs" | "view" | "ai";

export interface ShortcutDef {
  id: string;
  combo: string;
  label: string;
  group: ShortcutGroup;
  scope?: "global" | "terminal" | "ai";
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "settings.open",     combo: "cmd+,", label: "Open settings",      group: "general" },
  { id: "omnibar.open",      combo: "cmd+k", label: "Ask valley (omnibar)", group: "general" },

  { id: "tab.new",           combo: "cmd+t", label: "New tab",            group: "tabs" },
  { id: "tab.close",         combo: "cmd+w", label: "Close tab",          group: "tabs" },

  { id: "explorer.toggle",   combo: "cmd+b", label: "Toggle file explorer", group: "view" },

  { id: "ai.toggle",         combo: "cmd+i", label: "Toggle AI panel",    group: "ai" },
  { id: "ai.focus.composer", combo: "cmd+l", label: "Focus AI composer",  group: "ai" },
];

export const GROUP_LABELS: Record<ShortcutGroup, string> = {
  general: "GENERAL",
  tabs: "TABS",
  view: "VIEW",
  ai: "AI",
};

/** Render a combo string ("cmd+shift+]") as kbd-cap glyphs. */
export function comboGlyphs(combo: string): string[] {
  return combo.split("+").map((p) => {
    switch (p) {
      case "cmd": return "⌘";
      case "shift": return "⇧";
      case "alt": return "⌥";
      case "ctrl": return "⌃";
      case "enter": return "↩";
      case "esc": return "esc";
      case "tab": return "⇥";
      case "space": return "␣";
      case "up": return "↑";
      case "down": return "↓";
      case "left": return "←";
      case "right": return "→";
      default: return p.toUpperCase();
    }
  });
}

export function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const wantsCmd = parts.includes("cmd");
  const wantsShift = parts.includes("shift");
  const wantsAlt = parts.includes("alt");
  const key = parts[parts.length - 1];
  const meta = (e.metaKey || e.ctrlKey) === wantsCmd;
  const shift = e.shiftKey === wantsShift;
  const alt = e.altKey === wantsAlt;
  const k = e.key.toLowerCase();
  return meta && shift && alt && k === key;
}
