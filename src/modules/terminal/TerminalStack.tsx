import { useTabs } from "@/modules/tabs/useTabs";
import { Terminal } from "./Terminal";
import type { Pane } from "./lib/splits";

export function TerminalStack() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);

  return (
    <>
      {tabs.map((t) => (
        <div
          key={t.id}
          className={t.id === activeId ? "" : "invisible pointer-events-none"}
          style={{ position: "absolute", inset: 0 }}
        >
          <PaneTree pane={t.panes} />
        </div>
      ))}
    </>
  );
}

function PaneTree({ pane }: { pane: Pane }) {
  if (pane.kind === "leaf") {
    return <Terminal sessionId={pane.sessionId} focused={pane.active} />;
  }
  return (
    <div className={`vy-split ${pane.dir}`}>
      <PaneTree pane={pane.a} />
      <div className={`vy-gutter ${pane.dir}`} />
      <PaneTree pane={pane.b} />
    </div>
  );
}
