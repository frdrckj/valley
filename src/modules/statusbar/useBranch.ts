import { useEffect, useState } from "react";
import { native } from "@/lib/native";

/**
 * Read the current git branch from `<cwd>/.git/HEAD`.
 *
 * Two recognised formats:
 *   "ref: refs/heads/main\n"  → branch name "main"
 *   "<sha>\n"                 → detached HEAD, returns short sha
 *
 * Returns null if the path isn't a git repo or the file can't be read.
 * Walks upward through parent directories so being inside a sub-folder
 * of a repo still reports the repo's branch.
 */
export function useBranch(cwd: string | null): string | null {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) {
      setBranch(null);
      return;
    }
    let cancelled = false;

    void (async () => {
      let dir = cwd;
      // Walk up at most 12 levels to find a `.git/HEAD`.
      for (let i = 0; i < 12; i++) {
        try {
          const head = await native.fs.readFile(`${dir}/.git/HEAD`);
          if (cancelled) return;
          const m = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/);
          setBranch(m ? m[1] : head.trim().slice(0, 7));
          return;
        } catch {
          // not here — walk up
        }
        const parent = parentOf(dir);
        if (parent === dir) break;
        dir = parent;
      }
      if (!cancelled) setBranch(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [cwd]);

  return branch;
}

function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  if (i <= 0) return "/";
  return p.slice(0, i);
}
