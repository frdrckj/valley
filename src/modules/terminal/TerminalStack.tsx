import { useTabs, type Tab } from "@/modules/tabs/useTabs";
import { Terminal } from "./Terminal";
import { PreviewPane } from "@/modules/preview/PreviewPane";
import { FileViewer } from "@/modules/file/FileViewer";
import { DiffView } from "@/modules/diff/DiffView";

/**
 * Renders one absolutely-positioned body per tab. Inactive tabs use
 * `invisible pointer-events-none` so xterm/iframe instances stay mounted
 * (preserves scrollback / session state across tab switches).
 *
 * Split panes live in tmux — valley itself shows one terminal per tab.
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
          <TabBody tab={t} isActive={t.id === activeId} />
        </div>
      ))}
    </>
  );
}

function TabBody({ tab, isActive }: { tab: Tab; isActive: boolean }) {
  if (tab.kind === "preview") {
    return <PreviewPane tabId={tab.id} url={tab.url ?? "http://localhost:3000"} />;
  }
  if (tab.kind === "file") {
    return (
      <FileViewer
        tabId={tab.id}
        path={tab.path ?? ""}
        host={tab.host}
        active={isActive}
      />
    );
  }
  if (tab.kind === "diff") {
    return (
      <DiffView
        tabId={tab.id}
        path={tab.path ?? ""}
        mode={tab.diffMode ?? "working"}
      />
    );
  }
  return (
    <Terminal
      sessionId={tab.sessionId ?? `pty-${tab.id}`}
      focused
      tabActive={isActive}
    />
  );
}
