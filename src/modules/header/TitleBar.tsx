import { getCurrentWindow } from "@tauri-apps/api/window";

interface TitleBarProps {
  cwd?: string;
  branch?: string;
}

/**
 * macOS overlay title bar. The OS draws the real traffic lights — we leave
 * 80 px of left padding so cwd never overlaps them.
 *
 * Drag is wired imperatively via Tauri's `startDragging()` because the
 * declarative `data-tauri-drag-region` path is unreliable on this Tauri
 * 2.11 + macOS Sonoma combination. Both attributes are set anyway as a
 * belt-and-suspenders fallback.
 */
export function TitleBar({ cwd = "~/code/valley", branch = "main" }: TitleBarProps) {
  function isInteractive(target: EventTarget | null) {
    return Boolean(
      (target as HTMLElement | null)?.closest(
        "button, input, a, select, textarea",
      ),
    );
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || isInteractive(e.target)) return;
    void getCurrentWindow().startDragging();
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (isInteractive(e.target)) return;
    void getCurrentWindow().toggleMaximize();
  }

  return (
    <div
      className="vy-titlebar"
      data-tauri-drag-region
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div data-tauri-drag-region style={{ flex: 1 }} />
      <div className="vy-cwd" data-tauri-drag-region>
        <span style={{ color: "var(--text-muted)" }}>{cwd}</span>
        <span style={{ color: "var(--border-strong)", margin: "0 8px" }}>·</span>
        <span style={{ color: "var(--accent-primary)" }}>{branch}</span>
      </div>
    </div>
  );
}
