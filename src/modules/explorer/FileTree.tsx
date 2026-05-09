import { useTree } from "./lib/useTree";
import { Icon, type IconName } from "@/components/Icon";
import type { Side } from "@/lib/layout";
import type { DirEntry } from "@/lib/native";
import { useSettings } from "@/lib/settings";

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

  return (
    <>
      <div
        className="tree-row"
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => entry.isDir && toggle(entry.path)}
      >
        <span className="twisty">{twisty}</span>
        <Icon name={ico} size={12} />
        <span>{entry.name}</span>
      </div>
      {expanded && node?.children?.map((c) => (
        <Branch key={c.path} entry={c} depth={depth + 1} byPath={byPath} toggle={toggle} />
      ))}
    </>
  );
}
