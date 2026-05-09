import type { Terminal as XTerm } from "@xterm/xterm";

export interface OscEvents {
  /** Fired whenever the shell reports its cwd via OSC 7. */
  onCwd?: (cwd: string) => void;
  /** Fired on OSC 133 D — exit code of the last command. */
  onExitCode?: (code: number) => void;
}

/**
 * Hook valley's shell-integration OSC sequences into an xterm instance.
 *
 * - OSC 7   `\e]7;file://<host><path>\a`   — cwd reporting
 * - OSC 133 `\e]133;{A|B|C|D[;<n>]}\a`     — semantic prompt markers
 */
export function attachOscHandlers(term: XTerm, ev: OscEvents): () => void {
  const dispose7 = term.parser.registerOscHandler(7, (data) => {
    // data is `file://<host><path>` — strip the prefix.
    const m = /^file:\/\/[^/]*(.*)$/.exec(data);
    if (m && m[1]) ev.onCwd?.(decodeURIComponent(m[1]));
    return true;
  });

  const dispose133 = term.parser.registerOscHandler(133, (data) => {
    // A/B/C/D[;<exit>]
    if (data.startsWith("D")) {
      const parts = data.split(";");
      const code = parts[1] ? Number.parseInt(parts[1], 10) : 0;
      if (Number.isFinite(code)) ev.onExitCode?.(code);
    }
    return true;
  });

  return () => {
    dispose7.dispose();
    dispose133.dispose();
  };
}
