/**
 * Omnibar result sources.
 *
 * Each source returns typed items that Omnibar.tsx renders.
 * The cwd walk is lazy and cancellable via an AbortSignal.
 */
import type { Tab } from "@/modules/tabs/useTabs";
import { useTabs } from "@/modules/tabs/useTabs";
import { native } from "@/lib/native";
import { patchSettings } from "@/lib/settings";
import { dispatchShortcutById } from "@/modules/shortcuts/useGlobalShortcuts";
import { getRecentPaths } from "./recent";

/** ------------------------------------------------------------------ */
/*  Item types                                                           */
/** ------------------------------------------------------------------ */

export type TabItem = {
  kind: "tab";
  tabId: string;
  label: string;
  path: string | undefined;
  tabKind: Tab["kind"];
};

export type RecentItem = {
  kind: "recent";
  path: string;
  label: string;
};

export type FileItem = {
  kind: "file";
  path: string;
  label: string;
};

export type ModifiedItem = {
  kind: "modified";
  path: string;
  label: string;
  status: string;
};

export type CommandItem = {
  kind: "command";
  id: string;
  label: string;
  /** Display-only key hint, e.g. "⌘T". Falls back to no hint when omitted. */
  hint?: string;
  run: () => void | Promise<void>;
};

export type OmniItem =
  | TabItem
  | RecentItem
  | FileItem
  | ModifiedItem
  | CommandItem;

/** ------------------------------------------------------------------ */
/*  Source: open tabs                                                    */
/** ------------------------------------------------------------------ */

export function getOpenTabs(): TabItem[] {
  return useTabs.getState().tabs.map((t) => ({
    kind: "tab",
    tabId: t.id,
    label: t.label,
    path: t.path,
    tabKind: t.kind,
  }));
}

/** ------------------------------------------------------------------ */
/*  Source: recent files                                                 */
/** ------------------------------------------------------------------ */

/**
 * Scope recents to the active terminal's cwd subtree. Without this, paths
 * from a previously-active project leak into the omnibar after the user
 * `cd`'s elsewhere. When `cwd` is null (no detected cwd), every recent
 * is returned — degraded but better than empty.
 */
export function getRecentItems(cwd: string | null): RecentItem[] {
  const all = getRecentPaths();
  const filtered = cwd === null
    ? all
    : all.filter((p) => p === cwd || p.startsWith(cwd.replace(/\/+$/, "") + "/"));
  return filtered.map((p) => ({
    kind: "recent",
    path: p,
    label: basename(p),
  }));
}

/** ------------------------------------------------------------------ */
/*  Source: cwd file walk                                                */
/** ------------------------------------------------------------------ */

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  ".next",
  "build",
  ".cache",
]);

const MAX_DEPTH = 4;
const MAX_ENTRIES = 1000;

/**
 * BFS walk of `root`, yielding FileItems. Stops when cancelled via the
 * AbortSignal, when MAX_DEPTH is exceeded, or when MAX_ENTRIES is hit.
 */
export async function walkCwd(
  root: string,
  signal: AbortSignal,
): Promise<FileItem[]> {
  const results: FileItem[] = [];
  type QueueEntry = { path: string; depth: number };
  const queue: QueueEntry[] = [{ path: root, depth: 0 }];

  while (queue.length > 0 && results.length < MAX_ENTRIES) {
    if (signal.aborted) break;
    const entry = queue.shift()!;
    if (entry.depth > MAX_DEPTH) continue;

    let children;
    try {
      children = await native.fs.readDir(entry.path);
    } catch {
      continue;
    }

    for (const child of children) {
      if (signal.aborted) break;
      if (child.isDir) {
        if (!SKIP_DIRS.has(child.name)) {
          queue.push({ path: child.path, depth: entry.depth + 1 });
        }
      } else {
        results.push({ kind: "file", path: child.path, label: child.name });
        if (results.length >= MAX_ENTRIES) break;
      }
    }
  }

  return results;
}

/** ------------------------------------------------------------------ */
/*  Source: modified files (git)                                        */
/** ------------------------------------------------------------------ */

/**
 * Returns a list of modified/untracked files in the git repo containing
 * `cwd`. Empty array when not in a repo or when the call fails.
 */
export async function getModifiedFiles(cwd: string): Promise<ModifiedItem[]> {
  try {
    const repoRoot = await native.git.repoRoot(cwd);
    if (!repoRoot) return [];
    const entries = await native.git.status(repoRoot);
    return entries.map((e) => ({
      kind: "modified",
      path: `${repoRoot}/${e.path}`,
      label: basename(e.path),
      status: e.status,
    }));
  } catch {
    return [];
  }
}

/** ------------------------------------------------------------------ */
/*  Source: commands (palette)                                           */
/** ------------------------------------------------------------------ */

/**
 * Static set of command-palette actions. Each command either dispatches a
 * registered keyboard shortcut (so the same logic in App.tsx runs whether
 * the user invokes it via key or palette) or pokes a Zustand store
 * directly (theme switching, which has no native shortcut).
 */
export function getCommands(): CommandItem[] {
  return [
    {
      kind: "command",
      id: "tab.new",
      label: "New Terminal",
      hint: "⌘T",
      run: () => dispatchShortcutById("tab.new"),
    },
    {
      kind: "command",
      id: "tab.newPreview",
      label: "New Preview",
      hint: "⌘⇧Y",
      run: () => dispatchShortcutById("tab.newPreview"),
    },
    {
      kind: "command",
      id: "tab.close",
      label: "Close Active Tab",
      hint: "⌘W",
      run: () => dispatchShortcutById("tab.close"),
    },
    {
      kind: "command",
      id: "split.vertical",
      label: "Split Right",
      hint: "⌘D",
      run: () => dispatchShortcutById("split.vertical"),
    },
    {
      kind: "command",
      id: "split.horizontal",
      label: "Split Below",
      hint: "⌘⇧D",
      run: () => dispatchShortcutById("split.horizontal"),
    },
    {
      kind: "command",
      id: "sidebar.toggle",
      label: "Toggle File Explorer",
      hint: "⌘B",
      run: () => dispatchShortcutById("sidebar.toggle"),
    },
    {
      kind: "command",
      id: "search.focus",
      label: "Find in Terminal",
      hint: "⌘F",
      run: () => dispatchShortcutById("search.focus"),
    },
    {
      kind: "command",
      id: "shortcuts.open",
      label: "Show Keyboard Shortcuts",
      hint: "⌘K",
      run: () => dispatchShortcutById("shortcuts.open"),
    },
    {
      kind: "command",
      id: "settings.open",
      label: "Open Settings",
      hint: "⌘,",
      run: () => dispatchShortcutById("settings.open"),
    },
    {
      kind: "command",
      id: "ai.toggle",
      label: "Toggle AI Panel",
      hint: "⌘I",
      run: () => dispatchShortcutById("ai.toggle"),
    },
    {
      kind: "command",
      id: "theme.gruvbox-dark",
      label: "Theme: Gruvbox Dark",
      run: () => void patchSettings({ theme: "gruvbox-material-dark" }),
    },
    {
      kind: "command",
      id: "theme.gruvbox-light",
      label: "Theme: Gruvbox Light",
      run: () => void patchSettings({ theme: "gruvbox-light-hard" }),
    },
    {
      kind: "command",
      id: "theme.tokyo-night",
      label: "Theme: Tokyo Night Storm",
      run: () => void patchSettings({ theme: "tokyo-night-storm" }),
    },
    {
      kind: "command",
      id: "theme.nord",
      label: "Theme: Nord",
      run: () => void patchSettings({ theme: "nord" }),
    },
    {
      kind: "command",
      id: "theme.auto",
      label: "Theme: Auto (System)",
      run: () => void patchSettings({ theme: "auto" }),
    },
    {
      kind: "command",
      id: "engagement.new",
      label: "Engagement: New…",
      run: () => { import("@/modules/engagement/useEngagementDialog").then(({ useEngagementDialog }) => useEngagementDialog.getState().open("new")); },
    },
    {
      kind: "command",
      id: "engagement.switch",
      label: "Engagement: Switch…",
      run: () => { import("@/modules/engagement/useEngagementDialog").then(({ useEngagementDialog }) => useEngagementDialog.getState().open("switch")); },
    },
    {
      kind: "command",
      id: "engagement.edit",
      label: "Engagement: Edit current…",
      run: () => {
        import("@/modules/engagement/useEngagementDialog").then(({ useEngagementDialog }) => {
          import("@/modules/engagement/useEngagement").then(({ useEngagement }) => {
            if (!useEngagement.getState().activeId) return;
            useEngagementDialog.getState().open("edit");
          });
        });
      },
    },
  ];
}

/** Extract the last path segment as the display name. */
function basename(p: string): string {
  return p.replace(/\/$/, "").split("/").pop() ?? p;
}
