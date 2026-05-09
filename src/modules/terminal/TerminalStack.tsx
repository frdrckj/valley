import { useTabs, type Tab } from "@/modules/tabs/useTabs";
import { Terminal } from "./Terminal";
import { PreviewPane } from "@/modules/preview/PreviewPane";
import { focusPane, type Pane } from "./lib/splits";

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
  return <PaneTree tabId={tab.id} pane={tab.panes} />;
}

function PaneTree({ tabId, pane }: { tabId: string; pane: Pane }) {
  if (pane.kind === "leaf") {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        onMouseDown={(e) => {
          // Click anywhere on the pane → focus it. Stop propagation so the
          // outer pointer-events-none guard doesn't swallow the focus when
          // multiple inactive tabs co-exist with active splits.
          e.stopPropagation();
          if (!pane.active) {
            const next = focusPane(useTabs.getState().tabs.find((t) => t.id === tabId)?.panes ?? pane, pane.sessionId);
            useTabs.getState().setPanes(tabId, next);
          }
        }}
      >
        <Terminal sessionId={pane.sessionId} focused={pane.active} />
      </div>
    );
  }
  return (
    <div className={`vy-split ${pane.dir}`}>
      <PaneTree tabId={tabId} pane={pane.a} />
      <div className={`vy-gutter ${pane.dir}`} />
      <PaneTree tabId={tabId} pane={pane.b} />
    </div>
  );
}
