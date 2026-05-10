import { useEffect, useRef, useState } from "react";
import { native, type GitStatusEntry } from "@/lib/native";

const REFRESH_INTERVAL_MS = 4000;

/**
 * Resolves the git repo root from `root`, then polls for status every
 * 4 seconds. Returns a Map keyed by absolute file path.
 */
export function useGitStatus(root: string): Map<string, GitStatusEntry> {
  const [statusMap, setStatusMap] = useState<Map<string, GitStatusEntry>>(new Map());
  const rootRef = useRef(root);
  rootRef.current = root;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      if (cancelled) return;
      try {
        const repoRoot = await native.git.repoRoot(rootRef.current);
        if (!repoRoot || cancelled) return;

        const entries = await native.git.status(repoRoot);
        if (cancelled) return;

        const map = new Map<string, GitStatusEntry>();
        for (const entry of entries) {
          // Convert repo-relative path to absolute.
          const abs = `${repoRoot}/${entry.path}`;
          // Keep working-tree entry if both staged and working exist; staged wins if only staged.
          if (!map.has(abs) || !entry.staged) {
            map.set(abs, entry);
          }
        }
        setStatusMap(map);
      } catch {
        // Not in a repo or command failed — silently ignore.
      }

      if (!cancelled) {
        timer = setTimeout(() => { void refresh(); }, REFRESH_INTERVAL_MS);
      }
    }

    void refresh();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [root]);

  return statusMap;
}
