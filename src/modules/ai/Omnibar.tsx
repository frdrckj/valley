import { Icon, type IconName } from "@/components/Icon";
import { Kbd } from "@/components/Kbd";

interface OmniRowProps {
  icon: IconName;
  tone?: "muted" | "info";
  title: string;
  sub?: string;
  hot?: string;
  active?: boolean;
  dim?: boolean;
}

function OmniRow({
  icon,
  tone = "muted",
  title,
  sub,
  hot,
  active,
  dim,
}: OmniRowProps) {
  return (
    <div
      className={`omni-row${active ? " is-active" : ""}${dim ? " is-dim" : ""}`}
    >
      <Icon
        name={icon}
        size={13}
        style={{
          color: tone === "info" ? "var(--accent-info)" : "var(--text-muted)",
        }}
      />
      <div className="col">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </div>
      {hot && <Kbd>{hot}</Kbd>}
    </div>
  );
}

function OmniSep() {
  return <div className="omni-sep" />;
}

export function Omnibar() {
  return (
    <div className="vy-omni-overlay">
      <div className="vy-omni">
        <div className="vy-omni-head">
          <Icon name="sparkle" size={14} style={{ color: "var(--accent-ai)" }} />
          <input
            className="input"
            autoFocus
            defaultValue="explain the difference between"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="vy-omni-list">
          <OmniRow
            icon="terminal"
            tone="info"
            title='Run "explain"'
            sub="ask valley to explain the current selection"
            hot="↩"
            active
          />
          <OmniRow
            icon="search"
            title='Search project for "explain"'
            sub="34 matches in 12 files"
            hot="⌘P"
          />
          <OmniRow
            icon="file"
            title="src/lib/parser.ts"
            sub="src/lib · modified"
          />
          <OmniRow icon="folder" title="src-tauri/" sub="recent" />
          <OmniSep />
          <OmniRow icon="settings" title="Open settings" hot="⌘," dim />
          <OmniRow
            icon="vibrancy"
            title="Toggle vibrancy"
            sub="window blur · macOS only"
            dim
          />
        </div>
        <div className="vy-omni-foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↩</Kbd> select
          </span>
          <span>
            <Kbd>⌘</Kbd>
            <Kbd>↩</Kbd> ask valley
          </span>
          <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
            haiku · 0 tokens
          </span>
        </div>
      </div>
    </div>
  );
}
