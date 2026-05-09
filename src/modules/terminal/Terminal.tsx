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
      // xterm's canvas/WebGL renderer measures glyphs at construction time;
      // if @fontsource hasn't fired yet we get a system fallback baked in
      // for the life of the instance.
      if (typeof document !== "undefined" && document.fonts) {
        try {
          await document.fonts.load('13px "Geist Mono Variable"');
        } catch {
          /* not available — xterm falls back to ui-monospace */
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
