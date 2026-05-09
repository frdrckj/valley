export interface ShortcutDef {
  id: string;
  combo: string;
  label: string;
  scope?: "global" | "terminal" | "ai";
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "tab.new",           combo: "cmd+t",            label: "New tab" },
  { id: "tab.close",         combo: "cmd+w",            label: "Close tab" },
  { id: "ai.toggle",         combo: "cmd+i",            label: "Toggle AI panel" },
  { id: "ai.focus.composer", combo: "cmd+l",            label: "Focus AI composer" },
  { id: "omnibar.open",      combo: "cmd+k",            label: "Open omnibar" },
  { id: "explorer.toggle",   combo: "cmd+b",            label: "Toggle explorer" },
  { id: "settings.open",     combo: "cmd+,",            label: "Open settings" },
];

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
