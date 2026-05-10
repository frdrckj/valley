import { useTabs, type Tab } from "@/modules/tabs/useTabs";
import { Terminal } from "./Terminal";
import { PreviewPane } from "@/modules/preview/PreviewPane";
import { FileViewer } from "@/modules/file/FileViewer";
import { focusPane, updateSplitRatio, type Pane } from "./lib/splits";

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
  if (tab.kind === "file") {
    return <FileViewer path={tab.path ?? ""} />;
  }
  return <PaneTree tabId={tab.id} pane={tab.panes} path={[]} />;
}

interface PaneTreeProps {
  tabId: string;
  pane: Pane;
  /** Path of "a"/"b" picks from the root of `tab.panes`. Used by gutters. */
  path: Array<"a" | "b">;
}

function PaneTree({ tabId, pane, path }: PaneTreeProps) {
  if (pane.kind === "leaf") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          minHeight: 0,
        }}
        onMouseDown={(e) => {
          // Click anywhere on the pane → focus it. Stop propagation so the
          // outer pointer-events-none guard doesn't swallow the focus when
          // multiple inactive tabs co-exist with active splits.
          e.stopPropagation();
          if (!pane.active) {
            const next = focusPane(
              useTabs.getState().tabs.find((t) => t.id === tabId)?.panes ?? pane,
              pane.sessionId,
            );
            useTabs.getState().setPanes(tabId, next);
          }
        }}
      >
        <Terminal sessionId={pane.sessionId} focused={pane.active} />
      </div>
    );
  }

  // Split node — children are sized via `flex` from `pane.ratio`. Gutter
  // sits between them and drives ratio changes via mouse-drag.
  const ratio = pane.ratio;
  return (
    <div className={`vy-split ${pane.dir}`} style={{ width: "100%", height: "100%" }}>
      <div className="vy-split-child" style={{ flex: ratio }}>
        <PaneTree tabId={tabId} pane={pane.a} path={[...path, "a"]} />
      </div>
      <Gutter tabId={tabId} splitPath={path} dir={pane.dir} />
      <div className="vy-split-child" style={{ flex: 1 - ratio }}>
        <PaneTree tabId={tabId} pane={pane.b} path={[...path, "b"]} />
      </div>
    </div>
  );
}

interface GutterProps {
  tabId: string;
  splitPath: Array<"a" | "b">;
  dir: "v" | "h";
}

function Gutter({ tabId, splitPath, dir }: GutterProps) {
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const split = e.currentTarget.parentElement; // .vy-split wrapper
    if (!split) return;
    const rect = split.getBoundingClientRect();
    const horizontal = dir === "v"; // dir "v" = vertical pipe = side-by-side

    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      const ratio = horizontal
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top) / rect.height;
      const tab = useTabs.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      useTabs
        .getState()
        .setPanes(tab.id, updateSplitRatio(tab.panes, splitPath, ratio));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return <div className={`vy-gutter ${dir}`} onMouseDown={onMouseDown} />;
}
