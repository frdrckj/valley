import { useEffect, useRef } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";

interface TerminalProps {
  sessionId: string;
  cwd?: string;
  focused?: boolean;
}

export function Terminal({ sessionId, cwd, focused = true }: TerminalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const session = useTerminalSession({ sessionId, cwd });

  useEffect(() => {
    let cancelled = false;
    const host = ref.current;
    if (!host) return;

    void (async () => {
      // Wait for the terminal font (system-installed MesloLGS Nerd Font Mono)
      // so xterm's canvas renderer measures correctly. If absent, xterm falls
      // back to JetBrains → SF Mono per the family stack.
      if (typeof document !== "undefined" && document.fonts) {
        try {
          await document.fonts.load('17px "MesloLGS Nerd Font Mono"');
        } catch {
          /* not available — xterm falls back per family stack */
        }
      }
      if (cancelled) return;
      session.attach(host);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const r = new ResizeObserver(() => session.fit());
    if (ref.current) r.observe(ref.current);
    return () => r.disconnect();
  }, [session]);

  return (
    <div
      className="vy-term-pane"
      style={{ borderLeftColor: focused ? "var(--accent-primary)" : "transparent" }}
    >
      <div ref={ref} className="vy-xterm-host" />
    </div>
  );
}
