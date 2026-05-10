import { native, type PtyEvent } from "@/lib/native";

export interface PtyHandlers {
  onData: (bytes: Uint8Array) => void;
  onExit?: (code: number | null) => void;
}

export interface PtySession {
  id: string;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  close: () => Promise<void>;
}

interface OpenOptions {
  id: string;
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
}

/**
 * Open a PTY session and return a thin handle. Adapted from terax-ai's
 * pty-bridge — we keep valley's caller-supplied string id (so tab ids
 * survive persistence) but match terax's PtySession surface so the
 * lifecycle hook can drive write/resize/close imperatively.
 */
export async function openPty(
  opts: OpenOptions,
  handlers: PtyHandlers,
): Promise<PtySession> {
  const channel = new native.Channel<PtyEvent>();
  channel.onmessage = (ev) => {
    if (ev.type === "output") {
      handlers.onData(decodeBase64(ev.bytes));
    } else if (ev.type === "exit") {
      handlers.onExit?.(ev.code);
    }
  };

  await native.pty.open({
    id: opts.id,
    shell: opts.shell,
    cwd: opts.cwd,
    cols: opts.cols,
    rows: opts.rows,
    onEvent: channel,
  });

  return {
    id: opts.id,
    write: (data) => native.pty.write(opts.id, data),
    resize: (c, r) => native.pty.resize(opts.id, c, r),
    close: () => native.pty.close(opts.id),
  };
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
