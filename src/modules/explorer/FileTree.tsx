import { useEffect, useRef, useState } from "react";
import { useTree } from "./lib/useTree";
import { resolveIcon } from "./lib/iconResolver";
import { useGitStatus } from "./lib/useGitStatus";
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
  const { topLevel, byPath, toggle, unreachable } = useTree(root, showHidden);
  const gitStatus = useGitStatus(root);
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
        {unreachable ? (
          <div className="vy-tree-unreachable">
            <div className="vy-tree-unreachable-title">remote / unreachable</div>
            <div className="vy-tree-unreachable-sub" title={root}>
              {root}
            </div>
            <div className="vy-tree-unreachable-hint">
              the active terminal's cwd isn't on this machine. browse it from
              the terminal — the status bar still tracks it.
            </div>
          </div>
        ) : (
          topLevel.map((e) => (
            <Branch
              key={e.path}
              entry={e}
              depth={0}
              byPath={byPath}
              toggle={toggle}
              gitStatus={gitStatus}
            />
          ))
        )}
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
  gitStatus: Map<string, { status: string }>;
}

function Branch({ entry, depth, byPath, toggle, gitStatus }: BranchProps) {
  const node = byPath[entry.path];
  const expanded = entry.isDir && (node?.expanded ?? false);
  const ico = resolveIcon(entry.name, entry.isDir, expanded);
  const twisty = entry.isDir ? (expanded ? "▾" : "▸") : "";

  const statusEntry = gitStatus.get(entry.path);
  const statusCode = statusEntry?.status ?? null;

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape.
  useEffect(() => {
    if (!menuPos) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuPos(null);
    }
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPos(null);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [menuPos]);

  function onContextMenu(e: React.MouseEvent) {
    if (entry.isDir) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }

  function openDiffTab() {
    setMenuPos(null);
    const s = useTabs.getState();
    const existing = s.tabs.find((t) => t.kind === "diff" && t.path === entry.path);
    if (existing) {
      s.activate(existing.id);
    } else {
      s.open({ kind: "diff", label: entry.name, path: entry.path });
    }
  }

  /** Spawn a fresh terminal tab in the file's directory and run
   *  `$EDITOR <basename>` (defaulting to nvim if EDITOR isn't set).
   *  Uses an 800ms delay so the spawned shell has time to print its
   *  first prompt before we type the command — without this the bytes
   *  arrive before the shell is ready and get dropped or mangled. */
  function openInEditor() {
    setMenuPos(null);
    const dir = entry.path.replace(/\/[^/]+$/, "") || "/";
    const file = entry.name;
    const tabId = useTabs.getState().open({
      kind: "terminal",
      label: file,
      cwd: dir,
    });
    setTimeout(() => {
      void native.pty.write(
        `pty-${tabId}`,
        `\${EDITOR:-nvim} ${shellQuote(file)}\r`,
      );
    }, 800);
  }

  function onDoubleClick() {
    const sessionId = activeSessionId();
    if (!sessionId) return;
    if (entry.isDir) {
      void native.pty.write(sessionId, `cd ${shellQuote(entry.path)}\r`);
    } else {
      void native.pty.write(sessionId, ` ${shellQuote(entry.path)}`);
    }
  }

  function onClick() {
    if (entry.isDir) {
      toggle(entry.path);
      return;
    }
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
        onContextMenu={onContextMenu}
        title={
          entry.isDir
            ? `${entry.path}\nClick to expand · double-click to cd here`
            : `${entry.path}\nClick to open · double-click to insert path`
        }
      >
        <span className="twisty">{twisty}</span>
        <Icon name={ico.name} size={12} style={{ color: ico.color }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.name}
        </span>
        {statusCode && (
          <span className={`git-badge ${statusCode === "?" ? "untracked" : statusCode}`}>
            {statusCode}
          </span>
        )}
      </div>

      {menuPos && (
        <ContextMenu
          ref={menuRef}
          x={menuPos.x}
          y={menuPos.y}
          onDiff={openDiffTab}
          onOpenInEditor={openInEditor}
          onClose={() => setMenuPos(null)}
        />
      )}

      {expanded &&
        node?.children?.map((c) => (
          <Branch
            key={c.path}
            entry={c}
            depth={depth + 1}
            byPath={byPath}
            toggle={toggle}
            gitStatus={gitStatus}
          />
        ))}
    </>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  onDiff: () => void;
  onOpenInEditor: () => void;
  onClose: () => void;
  ref: React.RefObject<HTMLDivElement | null>;
}

const ContextMenu = function ContextMenu({
  x,
  y,
  onDiff,
  onOpenInEditor,
  ref,
}: ContextMenuProps) {
  return (
    <div
      ref={ref}
      className="vy-context-menu"
      style={{ position: "fixed", left: x, top: y, zIndex: 100 }}
    >
      <button
        className="vy-context-menu-item"
        onMouseDown={(e) => { e.preventDefault(); onOpenInEditor(); }}
      >
        Open in $EDITOR
      </button>
      <button
        className="vy-context-menu-item"
        onMouseDown={(e) => { e.preventDefault(); onDiff(); }}
      >
        Open diff vs HEAD
      </button>
    </div>
  );
};

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
