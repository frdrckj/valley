import { Dot } from "@/components/Dot";

export type AiState = "ready" | "thinking" | "error" | "offline";

interface StatusBarProps {
  aiState?: AiState;
  line?: number;
  col?: number;
  shell?: string;
}

const tones: Record<AiState, "purple" | "yellow" | "red" | "muted"> = {
  ready: "purple",
  thinking: "yellow",
  error: "red",
  offline: "muted",
};

export function StatusBar({
  aiState = "ready",
  line = 142,
  col = 8,
  shell = "zsh",
}: StatusBarProps) {
  return (
    <div className="vy-statusbar">
      <span className="cluster">
        <Dot tone={tones[aiState]} /> valley · {aiState}
      </span>
      <span className="cluster">
        <Dot tone="green" glow={false} /> 0 errors
      </span>
      <span className="cluster" style={{ color: "var(--text-muted)" }}>
        UTF-8 · LF
      </span>
      <span style={{ marginLeft: "auto" }} className="cluster">
        Ln {line} · Col {col}
      </span>
      <span className="cluster" style={{ color: "var(--text-muted)" }}>
        {shell}
      </span>
    </div>
  );
}
