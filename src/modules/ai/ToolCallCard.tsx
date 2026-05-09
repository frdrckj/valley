import { Btn } from "@/components/Btn";
import { Icon, type IconName } from "@/components/Icon";
import { Kbd } from "@/components/Kbd";

export type ToolKind = "file_read" | "write_file" | "run_command";
export type ToolStatus = "auto" | "approved" | "pending";

interface ToolCallCardProps {
  kind: ToolKind;
  name: string;
  status: ToolStatus;
  diff?: boolean;
}

const meta: Record<ToolKind, { tone: string; icon: IconName; verb: string }> = {
  file_read: { tone: "info", icon: "file", verb: "read" },
  write_file: { tone: "primary", icon: "file", verb: "write" },
  run_command: { tone: "warning", icon: "terminal", verb: "run" },
};

const statusBadge: Record<
  ToolStatus,
  { bg: string; fg: string; label: string }
> = {
  auto: {
    bg: "rgba(184,187,38,0.15)",
    fg: "var(--accent-success)",
    label: "auto · ✓",
  },
  approved: {
    bg: "rgba(184,187,38,0.15)",
    fg: "var(--accent-success)",
    label: "approved · ✓",
  },
  pending: {
    bg: "rgba(250,189,47,0.15)",
    fg: "var(--accent-primary)",
    label: "pending · approval",
  },
};

export function ToolCallCard({ kind, name, status, diff }: ToolCallCardProps) {
  const m = meta[kind];
  const sb = statusBadge[status];
  return (
    <div
      className="toolcall"
      style={
        status === "pending"
          ? { borderColor: "var(--accent-primary)" }
          : undefined
      }
    >
      <div className="head">
        <Icon
          name={m.icon}
          size={11}
          style={{ color: `var(--accent-${m.tone})` }}
        />
        <span className="name">{kind}</span>
        <span style={{ color: "var(--text-muted)" }}>{name}</span>
        <span className="badge" style={{ background: sb.bg, color: sb.fg }}>
          {sb.label}
        </span>
      </div>
      {diff && (
        <div className="body" style={{ fontSize: 11, lineHeight: 1.6 }}>
          <span style={{ color: "var(--accent-success)" }}>+ 14</span> &nbsp;
          <span style={{ color: "var(--accent-danger)" }}>− 3</span>
          <br />
          <span style={{ color: "var(--text-muted)" }}>
            add tokenizer for inline ghost suggestions
          </span>
        </div>
      )}
      {status === "pending" && (
        <div className="actions">
          <Btn variant="primary" style={{ height: 24, fontSize: 11 }}>
            Approve <Kbd dark>↩</Kbd>
          </Btn>
          <Btn variant="secondary" style={{ height: 24, fontSize: 11 }}>
            Diff
          </Btn>
          <Btn
            variant="ghost"
            style={{ height: 24, fontSize: 11, marginLeft: "auto" }}
          >
            Reject <Kbd>esc</Kbd>
          </Btn>
        </div>
      )}
    </div>
  );
}
