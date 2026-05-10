import { useTree } from "./lib/useTree";
import { resolveIcon } from "./lib/iconResolver";
import { Icon } from "@/components/Icon";
import { useLayout, type Side } from "@/lib/layout";
import { native, type DirEntry } from "@/lib/native";
import { useSettings } from "@/lib/settings";
import { useTabs } from "@/modules/tabs/useTabs";
import { findActive } from "@/modules/terminal/lib/splits";

interface FileTreeProps {
  root: string;
  collapsed?: boolean;
  side?: Side;
}

export function FileTree({ root, collapsed, side = "left" }: FileTreeProps) {
  const showHidden = useSettings().showHiddenFiles;
  const { sidebarWidth, setSidebarWidth } = useLayout();
  const { topLevel, byPath, toggle } = useTree(root, showHidden);
  if (collapsed) return null;

  return (
    <div className="vy-tree" data-side={side} style={{ width: sidebarWidth }}>
      <ResizeHandle
        side={side}
        width={sidebarWidth}
        onWidth={setSidebarWidth}
      />
      <div className="vy-tree-head">
        <span>EXPLORER</span>
      </div>
      <div className="vy-tree-body">
        {topLevel.map((e) => (
          <Branch
            key={e.path}
            entry={e}
            depth={0}
            byPath={byPath}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

interface ResizeHandleProps {
  side: Side;
  width: number;
  onWidth: (w: number) => void;
}

function ResizeHandle({ side, width, onWidth }: ResizeHandleProps) {
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      // Sidebar on right → dragging the left edge: rightward movement
      // shrinks the sidebar, so invert the delta.
      const delta = side === "right" ? startX - ev.clientX : ev.clientX - startX;
      onWidth(startW + delta);
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
  return (
    <div
      className={`vy-tree-resize ${side === "right" ? "left-edge" : "right-edge"}`}
      onMouseDown={onMouseDown}
    />
  );
}

interface BranchProps {
  entry: DirEntry;
  depth: number;
  byPath: Record<string, { expanded: boolean; children?: DirEntry[] }>;
  toggle: (path: string) => void;
}

function Branch({ entry, depth, byPath, toggle }: BranchProps) {
  const node = byPath[entry.path];
  const expanded = entry.isDir && (node?.expanded ?? false);
  const ico = resolveIcon(entry.name, entry.isDir, expanded);
  const twisty = entry.isDir ? (expanded ? "▾" : "▸") : "";

  function onDoubleClick() {
    const sessionId = activeSessionId();
    if (!sessionId) return;
    if (entry.isDir) {
      // `cd <path>\r` — send the full command + carriage return so the
      // shell executes it immediately, mirroring what the user would type.
      void native.pty.write(sessionId, `cd ${shellQuote(entry.path)}\r`);
    } else {
      // For files (double-click): insert the quoted path at the cursor.
      void native.pty.write(sessionId, ` ${shellQuote(entry.path)}`);
    }
  }

  function onClick() {
    if (entry.isDir) {
      toggle(entry.path);
      return;
    }
    // Open file in a new file-viewer tab. If a tab for this path already
    // exists, just activate it (no duplicates).
    const s = useTabs.getState();
    const existing = s.tabs.find(
      (t) => t.kind === "file" && t.path === entry.path,
    );
    if (existing) {
      s.activate(existing.id);
    } else {
      s.open({ kind: "file", label: entry.name, path: entry.path });
    }
  }

  return (
    <>
      <div
        className="tree-row"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title={
          entry.isDir
            ? `${entry.path}\nClick to expand · double-click to cd here`
            : `${entry.path}\nClick to open · double-click to insert path`
        }
      >
        <span className="twisty">{twisty}</span>
        <Icon name={ico.name} size={12} style={{ color: ico.color }} />
        <span>{entry.name}</span>
      </div>
      {expanded &&
        node?.children?.map((c) => (
          <Branch
            key={c.path}
            entry={c}
            depth={depth + 1}
            byPath={byPath}
            toggle={toggle}
          />
        ))}
    </>
  );
}

/** Find the currently-focused terminal pane's session id, or null. */
function activeSessionId(): string | null {
  const s = useTabs.getState();
  const tab = s.tabs.find((t) => t.id === s.activeId);
  if (!tab || tab.kind !== "terminal") return null;
  const active = findActive(tab.panes);
  return active?.sessionId ?? null;
}

/** POSIX single-quote a path so spaces / shell metacharacters don't break. */
function shellQuote(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}
