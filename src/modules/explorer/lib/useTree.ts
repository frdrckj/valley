import { useEffect, useState, useCallback } from "react";
import { native, type DirEntry } from "@/lib/native";

export interface TreeNode {
  entry: DirEntry;
  expanded: boolean;
  children?: DirEntry[];
}

export function useTree(root: string) {
  const [byPath, setByPath] = useState<Record<string, TreeNode>>({});
  const [topLevel, setTopLevel] = useState<DirEntry[]>([]);

  useEffect(() => {
    // Reset expanded-state cache whenever the root changes (e.g. user
    // `cd`'s in the active terminal). Otherwise stale paths from the
    // previous root linger and can never be cleaned up.
    setByPath({});
    setTopLevel([]);
    let cancelled = false;
    native.fs
      .readDir(root)
      .then((entries) => {
        if (!cancelled) setTopLevel(entries);
      })
      .catch(() => {
        if (!cancelled) setTopLevel([]);
      });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const toggle = useCallback(async (path: string) => {
    setByPath((prev) => {
      const node = prev[path];
      const expanded = !(node?.expanded ?? false);
      return { ...prev, [path]: { ...(node ?? {} as TreeNode), expanded } };
    });
    const existing = byPath[path];
    if (!existing?.children) {
      const children = await native.fs.readDir(path);
      setByPath((prev) => ({
        ...prev,
        [path]: { ...(prev[path] ?? {} as TreeNode), children },
      }));
    }
  }, [byPath]);

  return { topLevel, byPath, toggle };
}
