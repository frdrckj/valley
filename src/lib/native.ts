import { invoke as tauriInvoke, Channel } from "@tauri-apps/api/core";

export interface GitStatusEntry {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitDiffPayload {
  head: string;
  current: string;
  unified: string;
}

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

export type ReadResult =
  | { kind: "text"; content: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "toolarge"; size: number; limit: number };

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
    readFile(path: string): Promise<ReadResult> {
      return tauriInvoke("fs_read_file", { path });
    },
    /**
     * Convenience for callers that just want the text content. Throws if
     * the file is binary or larger than the editor's text-load limit.
     */
    async readText(path: string): Promise<string> {
      const r = await tauriInvoke<ReadResult>("fs_read_file", { path });
      if (r.kind === "text") return r.content;
      if (r.kind === "binary") throw new Error(`binary file: ${path}`);
      throw new Error(`file too large: ${path} (${r.size} > ${r.limit})`);
    },
    writeFile(path: string, contents: string): Promise<void> {
      return tauriInvoke("fs_write_file", { path, contents });
    },
    /**
     * Recursive mkdir (no-op if it already exists). Leading `~` and `~/`
     * are expanded on the Rust side, so callers can pass user-typed paths
     * unchanged.
     */
    createDir(path: string): Promise<void> {
      return tauriInvoke("fs_create_dir", { path });
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
  git: {
    repoRoot(path: string): Promise<string | null> {
      return tauriInvoke<string | null>("git_repo_root", { path });
    },
    status(repo: string): Promise<GitStatusEntry[]> {
      return tauriInvoke<GitStatusEntry[]>("git_status", { repo });
    },
    diff(repo: string, path: string, mode: "working" | "staged"): Promise<GitDiffPayload> {
      return tauriInvoke<GitDiffPayload>("git_diff", { repo, path, mode });
    },
  },
  ssh: {
    /** SFTP listing on a remote host. Connection is lazily opened and
     *  cached; `host` is the alias the user knows (resolved through
     *  ~/.ssh/config server-side). Throws on auth / connection errors
     *  with a human-readable message. */
    listDir(host: string, path: string): Promise<DirEntry[]> {
      return tauriInvoke<DirEntry[]>("ssh_list_dir", { host, path });
    },
    /** Recursive mkdir over SFTP. Tilde paths are expanded against the
     *  remote SSH user's home (resolved via canonicalize ".").
     *  Idempotent — re-creating an existing directory is a no-op.
     *  Used by remote-rooted engagements so the workspace folder
     *  lands on the host the operator is actually working from. */
    createDir(host: string, path: string): Promise<void> {
      return tauriInvoke("ssh_create_dir", { host, path });
    },
    /** SFTP read. Shape matches native.fs.readFile so editor tabs
     *  branch on `kind` without caring about transport. Returns
     *  `binary`/`toolarge` for non-text or oversize files. */
    readFile(host: string, path: string): Promise<ReadResult> {
      return tauriInvoke<ReadResult>("ssh_read_file", { host, path });
    },
    /** Convenience for callers that just want the text content of a
     *  remote file. Throws for binary/oversize, same as fs.readText. */
    async readText(host: string, path: string): Promise<string> {
      const r = await tauriInvoke<ReadResult>("ssh_read_file", { host, path });
      if (r.kind === "text") return r.content;
      if (r.kind === "binary") throw new Error(`binary file: ${host}:${path}`);
      throw new Error(`file too large: ${host}:${path} (${r.size} > ${r.limit})`);
    },
    writeFile(host: string, path: string, contents: string): Promise<void> {
      return tauriInvoke("ssh_write_file", { host, path, contents });
    },
    disconnect(host: string): Promise<void> {
      return tauriInvoke("ssh_disconnect", { host });
    },
  },
  Channel,
};
