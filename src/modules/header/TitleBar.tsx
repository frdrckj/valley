import { getCurrentWindow } from "@tauri-apps/api/window";

interface TitleBarProps {
  cwd?: string;
  branch?: string;
}

/**
 * macOS overlay title bar. The OS draws the real traffic lights — we leave
 * 76 px of left padding so cwd never overlaps them.
 *
 * Drag is wired imperatively via Tauri's `startDragging()` because the
 * declarative `data-tauri-drag-region` / `-webkit-app-region: drag` paths
 * proved unreliable in this build (silent no-op on macOS overlay style).
 */
export function TitleBar({ cwd = "~/code/valley", branch = "main" }: TitleBarProps) {
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, input, a, select, textarea")) return;
    void getCurrentWindow().startDragging();
  }

  function onDoubleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button, input, a, select, textarea")) return;
    void getCurrentWindow().toggleMaximize();
  }

  return (
    <div
      className="vy-titlebar"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div style={{ flex: 1 }} />
      <div className="vy-cwd">
        <span style={{ color: "var(--text-muted)" }}>{cwd}</span>
        <span style={{ color: "var(--border-strong)", margin: "0 8px" }}>·</span>
        <span style={{ color: "var(--accent-primary)" }}>{branch}</span>
      </div>
    </div>
  );
}
