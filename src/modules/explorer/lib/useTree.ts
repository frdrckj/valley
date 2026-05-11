import { useEffect, useState, useCallback } from "react";
import { native, type DirEntry } from "@/lib/native";

export interface TreeNode {
  entry: DirEntry;
  expanded: boolean;
  children?: DirEntry[];
}

export type TreeMode =
  /** Local fs walk succeeded. */
  | { kind: "local" }
  /** Sidebar is asking the SSH backend; nothing to render yet. */
  | { kind: "connecting"; host: string }
  /** SFTP listing succeeded. Browsing a remote machine. */
  | { kind: "remote"; host: string }
  /** Local fs failed and either no host or SSH failed too. */
  | { kind: "error"; host: string | null; message: string };

const HIDE_NAMES = new Set([
  // macOS / editor noise that's almost never useful in the explorer
  ".DS_Store",
  "node_modules",
  "__pycache__",
]);

function visible(entries: DirEntry[], showHidden: boolean): DirEntry[] {
  return entries.filter((e) => {
    if (HIDE_NAMES.has(e.name)) return false;
    if (!showHidden && e.name.startsWith(".")) return false;
    return true;
  });
}

/**
 * Resolve a directory listing either from the local filesystem or
 * (when the cwd is on a remote host the active terminal SSH'd into)
 * via SFTP. The first try is always local — fast and covers the
 * common case. Only on failure do we attempt SFTP, and only if the
 * caller supplied a non-empty `host` from the OSC 7 URI.
 */
export function useTree(root: string, showHidden = false, host?: string) {
  const [byPath, setByPath] = useState<Record<string, TreeNode>>({});
  const [topLevel, setTopLevel] = useState<DirEntry[]>([]);
  const [mode, setMode] = useState<TreeMode>({ kind: "local" });

  useEffect(() => {
    // Reset expanded-state cache whenever the root changes (e.g. user
    // `cd`'s in the active terminal). Otherwise stale paths from the
    // previous root linger and can never be cleaned up.
    setByPath({});
    setTopLevel([]);
    setMode({ kind: "local" });
    let cancelled = false;

    void (async () => {
      // 1. Try local first.
      try {
        const entries = await native.fs.readDir(root);
        if (cancelled) return;
        setTopLevel(visible(entries, showHidden));
        setMode({ kind: "local" });
        return;
      } catch {
        // Fall through to SFTP if we have a host.
      }

      const trimmed = host?.trim();
      if (!trimmed) {
        if (cancelled) return;
        setMode({
          kind: "error",
          host: null,
          message: "directory not available on this machine",
        });
        return;
      }

      // 2. SFTP attempt.
      if (cancelled) return;
      setMode({ kind: "connecting", host: trimmed });
      try {
        const entries = await native.ssh.listDir(trimmed, root);
        if (cancelled) return;
        setTopLevel(visible(entries, showHidden));
        setMode({ kind: "remote", host: trimmed });
      } catch (e) {
        if (cancelled) return;
        setMode({
          kind: "error",
          host: trimmed,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [root, showHidden, host]);

  /** Lazy-load children when a folder expands. Routes through the
   *  same source (local or SFTP) that produced the parent listing. */
  const toggle = useCallback(
    async (path: string) => {
      setByPath((prev) => {
        const node = prev[path];
        const expanded = !(node?.expanded ?? false);
        return { ...prev, [path]: { ...(node ?? ({} as TreeNode)), expanded } };
      });
      const existing = byPath[path];
      if (existing?.children) return;
      try {
        const children =
          mode.kind === "remote"
            ? await native.ssh.listDir(mode.host, path)
            : await native.fs.readDir(path);
        setByPath((prev) => ({
          ...prev,
          [path]: {
            ...(prev[path] ?? ({} as TreeNode)),
            children: visible(children, showHidden),
          },
        }));
      } catch {
        // leave it un-expanded with no children; the row stays clickable
      }
    },
    [byPath, showHidden, mode],
  );

  return { topLevel, byPath, toggle, mode };
}
