import { create } from "zustand";
import type { Pane } from "@/modules/terminal/lib/splits";
import { newLeaf } from "@/modules/terminal/lib/splits";

export type Tab = {
  id: string;
  kind: "terminal" | "preview" | "file" | "diff";
  cwd?: string;
  label: string;
  panes: Pane;
  /** Preview-tab url. Ignored for terminal tabs. */
  url?: string;
  /** File-tab / diff-tab absolute path. */
  path?: string;
  /** Set when the user manually renames the tab; suppresses cwd auto-labelling. */
  userRenamed?: boolean;
  /** File-tab unsaved-changes flag. Runtime-only; not persisted. */
  dirty?: boolean;
  /** Diff-tab mode: compare working tree vs HEAD, or staged index vs HEAD. */
  diffMode?: "working" | "staged";
};

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  open(tab: Omit<Tab, "id" | "panes"> & Partial<Pick<Tab, "id">>): string;
  close(id: string): void;
  activate(id: string): void;
  rename(id: string, label: string): void;
  setPanes(id: string, panes: Pane): void;
  setCwd(id: string, cwd: string): void;
  setUrl(id: string, url: string): void;
  setDirty(id: string, dirty: boolean): void;
}

let counter = 0;
const nextId = () => `t${++counter}-${Date.now().toString(36)}`;

/**
 * Derive a tab label from the active terminal's cwd. We use the last path
 * segment so `/Users/me/Documents/works/valley` becomes `valley`. The
 * home dir collapses to `~` for readability.
 */
function labelFromCwd(cwd: string): string {
  if (!cwd) return "zsh";
  const trimmed = cwd.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "/";
  // Match `/Users/<name>` exactly and collapse to `~`.
  if (/^\/Users\/[^/]+$/.test(trimmed)) return "~";
  const last = trimmed.split("/").pop();
  return last && last.length > 0 ? last : "/";
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  open(input) {
    const id = input.id ?? nextId();
    const tab: Tab = {
      id,
      kind: input.kind,
      cwd: input.cwd,
      label: input.label,
      panes: newLeaf(`pty-${id}`),
      url: input.url,
      path: input.path,
      diffMode: input.diffMode,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeId: id }));
    return id;
  },
  close(id) {
    const tabs = get().tabs.filter((t) => t.id !== id);
    const activeId =
      get().activeId === id ? (tabs[tabs.length - 1]?.id ?? null) : get().activeId;
    set({ tabs, activeId });
  },
  activate(id) {
    if (get().tabs.some((t) => t.id === id)) set({ activeId: id });
  },
  rename(id, label) {
    set({
      tabs: get().tabs.map((t) =>
        t.id === id ? { ...t, label, userRenamed: true } : t,
      ),
    });
  },
  setPanes(id, panes) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, panes } : t)) });
  },
  setCwd(id, cwd) {
    const t = get().tabs.find((t) => t.id === id);
    if (!t || t.cwd === cwd) return;
    // Auto-update the label from cwd unless the user explicitly renamed it.
    // Preview tabs handle their own labelling (via the hostname).
    const label =
      t.kind === "terminal" && !t.userRenamed ? labelFromCwd(cwd) : t.label;
    set({
      tabs: get().tabs.map((t) =>
        t.id === id ? { ...t, cwd, label } : t,
      ),
    });
  },
  setUrl(id, url) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, url } : t)) });
  },
  setDirty(id, dirty) {
    const t = get().tabs.find((t) => t.id === id);
    if (!t || !!t.dirty === dirty) return;
    set({
      tabs: get().tabs.map((t) =>
        t.id === id ? { ...t, dirty } : t,
      ),
    });
  },
}));
