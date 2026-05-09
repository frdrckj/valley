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
    if (ref.current) void session.attach(ref.current);
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
