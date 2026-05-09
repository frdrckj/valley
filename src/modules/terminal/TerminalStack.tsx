import { useTabs, type Tab } from "@/modules/tabs/useTabs";
import { Terminal } from "./Terminal";
import { PreviewPane } from "@/modules/preview/PreviewPane";
import type { Pane } from "./lib/splits";

/**
 * Renders one absolutely-positioned body per tab. Inactive tabs use
 * `invisible pointer-events-none` so xterm/iframe instances stay mounted
 * (preserves scrollback / session state across tab switches).
 */
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
          <TabBody tab={t} />
        </div>
      ))}
    </>
  );
}

function TabBody({ tab }: { tab: Tab }) {
  if (tab.kind === "preview") {
    return <PreviewPane tabId={tab.id} url={tab.url ?? "http://localhost:3000"} />;
  }
  return <PaneTree pane={tab.panes} />;
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
