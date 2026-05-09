import { Icon } from "@/components/Icon";
import { Dot } from "@/components/Dot";
import { useTabs } from "./useTabs";

interface TabStripProps {
  hidden?: boolean;
}

export function TabStrip({ hidden }: TabStripProps) {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const { activate, close, open } = useTabs.getState();

  if (hidden) {
    return (
      <div
        className="vy-tabs"
        style={{
          height: 4,
          padding: 0,
          overflow: "hidden",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      />
    );
  }

  return (
    <div className="vy-tabs">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab${t.id === activeId ? " is-active" : ""}`}
          onClick={() => activate(t.id)}
        >
          <Dot tone="muted" glow={false} />
          <span>{t.label}</span>
          <span
            className="x"
            onClick={(e) => {
              e.stopPropagation();
              close(t.id);
            }}
          >
            <Icon name="x" size={10} />
          </span>
        </div>
      ))}
      <div
        className="tab"
        style={{ padding: "0 8px" }}
        onClick={() => open({ kind: "terminal", label: "zsh" })}
      >
        <Icon name="plus" size={12} />
      </div>
    </div>
  );
}
