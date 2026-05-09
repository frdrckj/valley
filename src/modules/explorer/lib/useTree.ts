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
    void native.fs.readDir(root).then(setTopLevel);
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
