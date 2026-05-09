import { invoke as tauriInvoke, Channel } from "@tauri-apps/api/core";

export type PtyEvent =
  | { type: "output"; bytes: string }
  | { type: "exit"; code: number | null };

export interface PtyOpenArgs {
  id: string;
  shell?: string;
  cwd?: string;
  cols: number;
  rows: number;
  onEvent: Channel<PtyEvent>;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isSymlink: boolean;
}

/**
 * Single seam between TS and Rust. All `invoke()` calls live here so types are
 * authoritative and we can swap to a mock for tests without touching modules.
 */
export const native = {
  pty: {
    open(args: PtyOpenArgs): Promise<void> {
      const { onEvent, ...rest } = args;
      return tauriInvoke("pty_open", { ...rest, onEvent });
    },
    write(id: string, data: string): Promise<void> {
      return tauriInvoke("pty_write", { id, data });
    },
    resize(id: string, cols: number, rows: number): Promise<void> {
      return tauriInvoke("pty_resize", { id, cols, rows });
    },
    close(id: string): Promise<void> {
      return tauriInvoke("pty_close", { id });
    },
  },
  fs: {
    readDir(path: string): Promise<DirEntry[]> {
      return tauriInvoke("fs_read_dir", { path });
    },
    readFile(path: string): Promise<string> {
      return tauriInvoke("fs_read_file", { path });
    },
    writeFile(path: string, contents: string): Promise<void> {
      return tauriInvoke("fs_write_file", { path, contents });
    },
  },
  shell: {
    run(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
      return tauriInvoke("shell_run_command", { cmd, cwd });
    },
  },
  secrets: {
    get(key: string): Promise<string | null> {
      return tauriInvoke<string | null>("secrets_get", { key });
    },
    set(key: string, value: string): Promise<void> {
      return tauriInvoke("secrets_set", { key, value });
    },
    delete(key: string): Promise<void> {
      return tauriInvoke("secrets_delete", { key });
    },
  },
  Channel,
};
