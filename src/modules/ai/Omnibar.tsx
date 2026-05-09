import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Kbd } from "@/components/Kbd";
import { askValley } from "./lib/omnibar";

interface OmnibarProps {
  onClose?: () => void;
}

export function Omnibar({ onClose }: OmnibarProps) {
  const [text, setText] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const r = await askValley(text);
      setResponse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vy-omni-overlay" onClick={onClose}>
      <div className="vy-omni" onClick={(e) => e.stopPropagation()}>
        <div className="vy-omni-head">
          <Icon name="sparkle" size={14} style={{ color: "var(--accent-ai)" }} />
          <input
            className="input"
            autoFocus
            placeholder="ask valley…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") onClose?.();
            }}
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="vy-omni-list" style={{ minHeight: 60 }}>
          {busy && (
            <div style={{ padding: "12px 14px", color: "var(--text-muted)" }}>
              thinking…
            </div>
          )}
          {error && (
            <div style={{ padding: "12px 14px", color: "var(--accent-danger)" }}>
              {error}
            </div>
          )}
          {response && (
            <div
              style={{
                padding: "12px 14px",
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {response}
            </div>
          )}
        </div>
        <div className="vy-omni-foot">
          <span>
            <Kbd>↩</Kbd> ask valley
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
          <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
            haiku · 0 tokens
          </span>
        </div>
      </div>
    </div>
  );
}
