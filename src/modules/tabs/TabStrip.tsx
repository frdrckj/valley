import { Icon } from "@/components/Icon";
import { Dot } from "@/components/Dot";

export interface Tab {
  id: string;
  label: string;
  tone?: "muted" | "green" | "yellow" | "red" | "purple";
}

interface TabStripProps {
  tabs: Tab[];
  activeId: string;
  onActivate?: (id: string) => void;
  onClose?: (id: string) => void;
  onNew?: () => void;
  hidden?: boolean;
}

export function TabStrip({
  tabs,
  activeId,
  onActivate,
  onClose,
  onNew,
  hidden,
}: TabStripProps) {
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
          onClick={() => onActivate?.(t.id)}
        >
          <Dot tone={t.tone} glow={false} />
          <span>{t.label}</span>
          <span
            className="x"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.(t.id);
            }}
          >
            <Icon name="x" size={10} />
          </span>
        </div>
      ))}
      <div className="tab" style={{ padding: "0 8px" }} onClick={onNew}>
        <Icon name="plus" size={12} />
      </div>
    </div>
  );
}
