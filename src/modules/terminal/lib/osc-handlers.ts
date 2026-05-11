import type { Terminal as XTerm } from "@xterm/xterm";

export interface OscEvents {
  /** Fired whenever the shell reports its cwd via OSC 7. The host
   *  field comes from the URI's authority — used by the sidebar to
   *  decide local vs SFTP. Empty string when the URI omits it. */
  onCwd?: (cwd: string, host: string) => void;
  /** Fired on OSC 133 A — prompt about to render. The block tracker
   *  should register a marker at the current line. */
  onPromptStart?: () => void;
  /** Fired on OSC 133 C — command starts executing (between input
   *  Enter and first output byte). Used to time how long a command runs. */
  onCommandStart?: () => void;
  /** Fired on OSC 133 D — exit code of the most-recent command. */
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
    // Capture host AND path separately. Path is what most callers want;
    // host is what the sidebar consults to fall back to SFTP.
    const m = /^file:\/\/([^/]*)(.*)$/.exec(data);
    if (m && m[2]) ev.onCwd?.(decodeURIComponent(m[2]), m[1] ?? "");
    return true;
  });

  const dispose133 = term.parser.registerOscHandler(133, (data) => {
    // A/B/C/D[;<exit>]. We only fire callbacks for the states we use —
    // B (input start) is informational and ignored.
    if (data.startsWith("A")) {
      ev.onPromptStart?.();
    } else if (data.startsWith("C")) {
      ev.onCommandStart?.();
    } else if (data.startsWith("D")) {
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
