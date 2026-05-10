import { useTree } from "./lib/useTree";
import { Icon, type IconName } from "@/components/Icon";
import type { Side } from "@/lib/layout";
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
  const { topLevel, byPath, toggle } = useTree(root, showHidden);
  if (collapsed) return null;

  return (
    <div className="vy-tree" data-side={side}>
      <div className="vy-tree-head">
        <span>EXPLORER</span>
      </div>
      {topLevel.map((e) => (
        <Branch key={e.path} entry={e} depth={0} byPath={byPath} toggle={toggle} />
      ))}
    </div>
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
  const ico: IconName = entry.isDir ? (expanded ? "folder-open" : "folder") : "file";
  const twisty = entry.isDir ? (expanded ? "▾" : "▸") : "";

  function onDoubleClick() {
    const sessionId = activeSessionId();
    if (!sessionId) return;
    if (entry.isDir) {
      // `cd <path>\r` — send the full command + carriage return so the
      // shell executes it immediately, mirroring what the user would type.
      void native.pty.write(sessionId, `cd ${shellQuote(entry.path)}\r`);
    } else {
      // For files: insert the quoted path at the cursor without executing.
      // Lets the user prepend `cat`, `code`, etc. and hit ↩ themselves.
      void native.pty.write(sessionId, ` ${shellQuote(entry.path)}`);
    }
  }

  return (
    <>
      <div
        className="tree-row"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => entry.isDir && toggle(entry.path)}
        onDoubleClick={onDoubleClick}
        title={
          entry.isDir
            ? `${entry.path}\nDouble-click to cd here`
            : `${entry.path}\nDouble-click to insert path`
        }
      >
        <span className="twisty">{twisty}</span>
        <Icon name={ico} size={12} />
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
