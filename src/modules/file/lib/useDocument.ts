import { useCallback, useEffect, useRef, useState } from "react";
import { native } from "@/lib/native";

/**
 * Editor document state. Adapted from terax-ai's useDocument — same status
 * machine and dirty tracking, swapped onto valley's native.fs shim.
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
  onDirtyChange?: (dirty: boolean) => void;
}

export function useDocument({ path, onDirtyChange }: Options) {
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

    native.fs
      .readFile(path)
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
  }, [path, reloadCounter]);

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
    // If this path is inside the Vite-watched tree, the chokidar event
    // would trigger HMR and reload the whole page — wiping terminal
    // sessions, scroll, selection. The valley-self-save plugin reads
    // this socket message and mutes the next change for `path`.
    if (typeof import.meta.hot !== "undefined") {
      import.meta.hot?.send("valley:saved", { path });
    }
    await native.fs.writeFile(path, content);
    savedRef.current = content;
    setDirty(false);
  }, [path]);

  return { doc, dirty, onChange, save, reload };
}
