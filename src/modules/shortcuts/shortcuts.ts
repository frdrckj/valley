/**
 * Single source of truth for keyboard shortcuts. Each entry carries
 * display tokens for the dialog AND a `match` predicate over the live
 * KeyboardEvent so the dialog can never lie about a binding the
 * runtime no longer matches.
 */

const IS_MAC =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.userAgent);

export type ShortcutId =
  | "tab.new"
  | "tab.newPreview"
  | "tab.newEditor"
  | "tab.close"
  | "tab.next"
  | "tab.prev"
  | "tab.selectByIndex"
  | "split.vertical"
  | "split.horizontal"
  | "pane.focus.left"
  | "pane.focus.right"
  | "pane.focus.up"
  | "pane.focus.down"
  | "search.focus"
  | "prompt.prev"
  | "prompt.next"
  | "block.copy"
  | "ai.toggle"
  | "ai.askSelection"
  | "shortcuts.open"
  | "settings.open"
  | "sidebar.toggle"
  | "omnibar.open";

export type ShortcutGroup =
  | "General"
  | "Tabs"
  | "Splits"
  | "Search"
  | "AI"
  | "View";

export type Shortcut = {
  id: ShortcutId;
  label: string;
  keys: string[];
  group: ShortcutGroup;
  match: (e: KeyboardEvent) => boolean;
};

// Platform-correct primary modifier. macOS uses ⌘ exclusively so every
// `Ctrl+key` (Ctrl+W/B/F/E/I/L/K/P used by tmux/nvim/CodeMirror inside
// the embedded terminal) passes straight through to the running shell.
// Linux/Windows use Ctrl as the conventional app-shortcut modifier.
const isMod = (e: KeyboardEvent) =>
  IS_MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;

export const SHORTCUTS: Shortcut[] = [
  {
    id: "shortcuts.open",
    label: "Show keyboard shortcuts",
    keys: ["⌘", "K"],
    group: "General",
    match: (e) => isMod(e) && e.key.toLowerCase() === "k",
  },
  {
    id: "settings.open",
    label: "Open settings",
    keys: ["⌘", ","],
    group: "General",
    match: (e) => isMod(e) && e.key === ",",
  },
  {
    id: "tab.new",
    label: "New tab",
    keys: ["⌘", "T"],
    group: "Tabs",
    match: (e) => isMod(e) && e.key.toLowerCase() === "t",
  },
  {
    id: "omnibar.open",
    label: "Quick switcher",
    keys: ["⌘", "P"],
    group: "General",
    match: (e) => isMod(e) && !e.shiftKey && e.key.toLowerCase() === "p",
  },
  {
    // Moved from Cmd+P to Cmd+Shift+Y to free Cmd+P for the quick switcher.
    id: "tab.newPreview",
    label: "New preview tab",
    keys: ["⌘", "⇧", "Y"],
    group: "Tabs",
    match: (e) => isMod(e) && e.shiftKey && e.key.toLowerCase() === "y",
  },
  {
    id: "tab.newEditor",
    label: "New editor tab",
    keys: ["⌘", "E"],
    group: "Tabs",
    match: (e) => isMod(e) && !e.shiftKey && e.key.toLowerCase() === "e",
  },
  {
    id: "tab.close",
    label: "Close tab",
    keys: ["⌘", "W"],
    group: "Tabs",
    match: (e) => isMod(e) && e.key.toLowerCase() === "w",
  },
  {
    id: "tab.next",
    label: "Next tab",
    keys: ["⌘", "⇧", "]"],
    group: "Tabs",
    // Match by physical code so it works regardless of which character the
    // Shift modifier produces on a given keyboard layout (e.g. "}" on US).
    match: (e) => isMod(e) && e.shiftKey && e.code === "BracketRight",
  },
  {
    id: "tab.prev",
    label: "Previous tab",
    keys: ["⌘", "⇧", "["],
    group: "Tabs",
    match: (e) => isMod(e) && e.shiftKey && e.code === "BracketLeft",
  },
  {
    id: "tab.selectByIndex",
    label: "Jump to tab 1–9",
    keys: ["⌘", "1…9"],
    group: "Tabs",
    match: (e) => isMod(e) && /^[1-9]$/.test(e.key),
  },
  {
    id: "split.vertical",
    label: "Split right",
    keys: ["⌘", "D"],
    group: "Splits",
    match: (e) => isMod(e) && !e.shiftKey && e.key.toLowerCase() === "d",
  },
  {
    id: "split.horizontal",
    label: "Split below",
    keys: ["⌘", "⇧", "D"],
    group: "Splits",
    match: (e) => isMod(e) && e.shiftKey && e.key.toLowerCase() === "d",
  },
  {
    id: "pane.focus.left",
    label: "Focus left pane",
    keys: ["⌘", "⌥", "←"],
    group: "Splits",
    match: (e) => isMod(e) && e.altKey && e.key === "ArrowLeft",
  },
  {
    id: "pane.focus.right",
    label: "Focus right pane",
    keys: ["⌘", "⌥", "→"],
    group: "Splits",
    match: (e) => isMod(e) && e.altKey && e.key === "ArrowRight",
  },
  {
    id: "pane.focus.up",
    label: "Focus pane above",
    keys: ["⌘", "⌥", "↑"],
    group: "Splits",
    match: (e) => isMod(e) && e.altKey && e.key === "ArrowUp",
  },
  {
    id: "pane.focus.down",
    label: "Focus pane below",
    keys: ["⌘", "⌥", "↓"],
    group: "Splits",
    match: (e) => isMod(e) && e.altKey && e.key === "ArrowDown",
  },
  {
    id: "search.focus",
    label: "Find in terminal",
    keys: ["⌘", "F"],
    group: "Search",
    match: (e) => isMod(e) && e.key.toLowerCase() === "f",
  },
  {
    id: "prompt.prev",
    label: "Previous prompt",
    keys: ["⌘", "⇧", "↑"],
    group: "Search",
    match: (e) => isMod(e) && e.shiftKey && e.key === "ArrowUp",
  },
  {
    id: "prompt.next",
    label: "Next prompt",
    keys: ["⌘", "⇧", "↓"],
    group: "Search",
    match: (e) => isMod(e) && e.shiftKey && e.key === "ArrowDown",
  },
  {
    id: "block.copy",
    label: "Copy current block output",
    keys: ["⌘", "⇧", "C"],
    group: "Search",
    match: (e) => isMod(e) && e.shiftKey && e.key.toLowerCase() === "c",
  },
  {
    id: "ai.toggle",
    label: "Toggle AI agent",
    keys: ["⌘", "I"],
    group: "AI",
    match: (e) => isMod(e) && e.key.toLowerCase() === "i",
  },
  {
    id: "ai.askSelection",
    label: "Ask AI about selection",
    keys: ["⌘", "L"],
    group: "AI",
    match: (e) => isMod(e) && e.key.toLowerCase() === "l",
  },
  {
    id: "sidebar.toggle",
    label: "Toggle file explorer",
    keys: ["⌘", "B"],
    group: "View",
    match: (e) => isMod(e) && e.key.toLowerCase() === "b",
  },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  "General",
  "Tabs",
  "Splits",
  "View",
  "Search",
  "AI",
];
