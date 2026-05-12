import { useCallback, useEffect, useRef, useState } from "react";
import { native } from "@/lib/native";

/**
 * Editor document state on top of valley's native.fs shim.
 *
 * `savedRef` is the contents on disk; `bufferRef` is what the user has
 * typed. Dirty = the two diverge. Save flushes buffer → disk and resets
 * savedRef so the next change correctly toggles dirty back on.
 */

export type DocumentState =
  | { status: "loading" }
  | { status: "ready"; content: string; size: number }
  | { status: "binary"; size: number }
  | { status: "toolarge"; size: number; limit: number }
  | { status: "error"; message: string };

interface Options {
  path: string;
  /** SSH alias when the file lives on a remote host. Empty/undefined =
   *  local Mac path; reads/writes route through native.fs. Anything
   *  else routes through native.ssh (SFTP read/write). The choice is
   *  per-tab so two file tabs — one local, one remote — coexist
   *  without leaking state across each other. */
  host?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export function useDocument({ path, host, onDirtyChange }: Options) {
  const [doc, setDoc] = useState<DocumentState>({ status: "loading" });
  const [dirty, setDirty] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);

  const savedRef = useRef<string>("");
  const bufferRef = useRef<string>("");
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    setDoc({ status: "loading" });
    setDirty(false);

    // Route based on `host`: SFTP for remote files, local fs otherwise.
    // Both commands return the same `ReadResult` shape so the rest of
    // the editor pipeline doesn't need to know which transport ran.
    const reader = host
      ? native.ssh.readFile(host, path)
      : native.fs.readFile(path);

    reader
      .then((res) => {
        if (cancelled) return;
        if (res.kind === "text") {
          savedRef.current = res.content;
          bufferRef.current = res.content;
          setDoc({ status: "ready", content: res.content, size: res.size });
        } else if (res.kind === "binary") {
          setDoc({ status: "binary", size: res.size });
        } else {
          setDoc({ status: "toolarge", size: res.size, limit: res.limit });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setDoc({
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          });
      });

    return () => {
      cancelled = true;
    };
  }, [path, host, reloadCounter]);

  /** Re-read from disk. Silent no-op if dirty (don't clobber user edits). */
  const reload = useCallback((): boolean => {
    if (dirtyRef.current) return false;
    setReloadCounter((n) => n + 1);
    return true;
  }, []);

  const onChange = useCallback((next: string) => {
    bufferRef.current = next;
    setDirty(next !== savedRef.current);
  }, []);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    const content = bufferRef.current;
    // HMR notification only matters for local files — there's no chance
    // of a remote SFTP write triggering Vite's chokidar watcher.
    if (!host && typeof import.meta.hot !== "undefined") {
      import.meta.hot?.send("valley:saved", { path });
    }
    if (host) {
      await native.ssh.writeFile(host, path, content);
    } else {
      await native.fs.writeFile(path, content);
    }
    savedRef.current = content;
    setDirty(false);
  }, [path, host]);

  return { doc, dirty, onChange, save, reload };
}
