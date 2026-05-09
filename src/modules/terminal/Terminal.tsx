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
      // Wait for fonts so xterm's canvas-based renderer measures correctly.
      // MesloLGS Nerd Font Mono is system-installed (p10k recommends it);
      // Geist Mono Variable is bundled via @fontsource.
      if (typeof document !== "undefined" && document.fonts) {
        try {
          await Promise.all([
            document.fonts.load('14px "MesloLGS Nerd Font Mono"'),
            document.fonts.load('14px "Geist Mono Variable"'),
          ]);
        } catch {
          /* not available — xterm falls back to system mono */
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
