import { Icon } from "@/components/Icon";
import type { Side } from "@/lib/layout";
import { ToolCallCard } from "./ToolCallCard";

interface AiPanelProps {
  width?: number;
  withToolCall?: boolean;
  pinned?: boolean;
  onPin?: () => void;
  side?: Side;
}

export function AiPanel({
  width = 360,
  withToolCall,
  pinned = true,
  onPin,
  side = "right",
}: AiPanelProps) {
  return (
    <div className="vy-aipanel" data-side={side} style={{ width }}>
      <div className="vy-aipanel-head">
        <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
        <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>
          valley
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            gap: 6,
            color: "var(--text-muted)",
          }}
        >
          <Icon name="plus" size={12} />
          <Icon
            name="pin"
            size={12}
            onClick={onPin}
            style={{
              color: pinned ? "var(--accent-primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          />
          <Icon name="x" size={12} />
        </span>
      </div>

      <div className="vy-aipanel-body">
        <div className="msg user">
          <div className="who">you · 2:38 pm</div>
          <div className="bubble">
            refactor the parser to support inline ghost suggestions
          </div>
        </div>

        <div className="msg ai">
          <div className="who">
            <Icon name="sparkle" size={11} style={{ color: "var(--accent-ai)" }} />{" "}
            valley · thinking
          </div>
          <div className="bubble">
            I'll add a tokenizer pass for ghost completion. Reading the current
            parser:
          </div>
        </div>

        <ToolCallCard kind="file_read" name="src/lib/parser.ts" status="auto" />

        {withToolCall ? (
          <ToolCallCard
            kind="write_file"
            name="src/lib/parser.ts"
            status="pending"
            diff
          />
        ) : (
          <ToolCallCard
            kind="write_file"
            name="src/lib/parser.ts"
            status="approved"
          />
        )}

        <div className="msg ai">
          <div className="who">
            <Icon name="sparkle" size={11} style={{ color: "var(--accent-ai)" }} />{" "}
            valley
          </div>
          <div className="bubble">
            Done. Tokenizer adds <span className="mono">GhostToken</span> with
            one-line lookahead — 14 lines added, 3 removed.
          </div>
        </div>
      </div>

      <div className="vy-aipanel-composer">
        <Icon name="clip" size={13} style={{ color: "var(--text-muted)" }} />
        <input
          className="input"
          placeholder="ask valley · ⌘L to focus"
          style={{ flex: 1 }}
        />
        <Icon name="mic" size={13} style={{ color: "var(--text-muted)" }} />
        <Icon name="send" size={13} style={{ color: "var(--accent-primary)" }} />
      </div>
    </div>
  );
}
