import type { Terminal as XTerm } from "@xterm/xterm";
import { native, type PtyEvent } from "@/lib/native";

export interface PtyBridge {
  /** Free the channel + close the Rust session. */
  dispose(): Promise<void>;
}

interface OpenOptions {
  id: string;
  cwd?: string;
  shell?: string;
  term: XTerm;
  onExit?: (code: number | null) => void;
  onOutput?: (raw: Uint8Array) => void;
}

/** Open a PTY session and pipe it into an xterm instance. Returns a disposer. */
export async function openPty(opts: OpenOptions): Promise<PtyBridge> {
  const channel = new native.Channel<PtyEvent>();
  channel.onmessage = (ev) => {
    if (ev.type === "output") {
      const raw = decodeBase64(ev.bytes);
      opts.term.write(raw);
      opts.onOutput?.(raw);
    } else if (ev.type === "exit") {
      opts.onExit?.(ev.code);
    }
  };

  await native.pty.open({
    id: opts.id,
    shell: opts.shell,
    cwd: opts.cwd,
    cols: opts.term.cols,
    rows: opts.term.rows,
    onEvent: channel,
  });

  // Forward keystrokes / paste from xterm to the PTY.
  const dataDisposer = opts.term.onData((d) => {
    void native.pty.write(opts.id, d);
  });
  const resizeDisposer = opts.term.onResize(({ cols, rows }) => {
    void native.pty.resize(opts.id, cols, rows);
  });

  return {
    async dispose() {
      dataDisposer.dispose();
      resizeDisposer.dispose();
      await native.pty.close(opts.id);
    },
  };
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
