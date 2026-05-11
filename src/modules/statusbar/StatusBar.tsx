import { Dot } from "@/components/Dot";
import { Icon } from "@/components/Icon";
import { useTabs } from "@/modules/tabs/useTabs";
import { useEngagement } from "@/modules/engagement/useEngagement";
import { useEngagementDialog } from "@/modules/engagement/useEngagementDialog";
import { useBranch } from "./useBranch";

export type AiState = "ready" | "thinking" | "error" | "offline";

interface StatusBarProps {
  aiState?: AiState;
}

const tones: Record<AiState, "purple" | "yellow" | "red" | "muted"> = {
  ready: "purple",
  thinking: "yellow",
  error: "red",
  offline: "muted",
};

export function StatusBar({ aiState = "ready" }: StatusBarProps) {
  const cwd = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.cwd ?? null,
  );
  const kind = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.kind ?? "terminal",
  );
  const branch = useBranch(cwd);
  const activeEngagement = useEngagement((s) => s.active());

  const cwdLabel = pretty(cwd);

  function openEngagementSwitch() {
    useEngagementDialog.getState().open("switch");
  }

  return (
    <div className="vy-statusbar">
      <span className="cluster">
        <Dot tone={tones[aiState]} /> valley · {aiState}
      </span>

      {activeEngagement && (
        <button
          type="button"
          className="vy-statusbar-engagement"
          onClick={openEngagementSwitch}
          title={`Engagement: ${activeEngagement.name} — click to switch`}
        >
          <Icon name="pin" size={11} />
          {activeEngagement.name}
          <span className="vy-statusbar-engagement-scope">
            · {activeEngagement.scope.length} in scope
          </span>
        </button>
      )}

      {cwdLabel && (
        <span
          className="cluster"
          style={{ color: "var(--text-muted)" }}
          title={cwd ?? undefined}
        >
          <Icon name="folder" size={11} />
          {cwdLabel}
        </span>
      )}

      {branch && (
        <span
          className="cluster"
          style={{ color: "var(--accent-primary)" }}
          title={`git branch: ${branch}`}
        >
          ⎇ {branch}
        </span>
      )}

      <span style={{ marginLeft: "auto" }} className="cluster">
        <span style={{ color: "var(--text-muted)" }}>
          {kind === "preview" ? "preview" : "zsh"}
        </span>
      </span>
    </div>
  );
}

/**
 * Collapse `/Users/<name>/...` to `~/...` and trim long paths to a tail-end
 * preview so the status bar doesn't grow unboundedly.
 */
function pretty(cwd: string | null): string | null {
  if (!cwd) return null;
  const usersMatch = cwd.match(/^\/Users\/[^/]+(\/.*)?$/);
  const collapsed = usersMatch ? `~${usersMatch[1] ?? ""}` : cwd;
  if (collapsed.length <= 56) return collapsed;
  return `…${collapsed.slice(-55)}`;
}
