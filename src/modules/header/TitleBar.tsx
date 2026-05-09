interface TitleBarProps {
  cwd?: string;
  branch?: string;
}

/**
 * macOS overlay title bar. The OS draws the real traffic lights — we leave
 * 76 px of left padding so cwd never overlaps them. Drag is handled by Tauri
 * via the `data-tauri-drag-region` attribute on the bar and its children.
 */
export function TitleBar({ cwd = "~/code/valley", branch = "main" }: TitleBarProps) {
  return (
    <div className="vy-titlebar" data-tauri-drag-region>
      <div data-tauri-drag-region style={{ flex: 1 }} />
      <div className="vy-cwd" data-tauri-drag-region>
        <span style={{ color: "var(--text-muted)" }}>{cwd}</span>
        <span style={{ color: "var(--border-strong)", margin: "0 8px" }}>·</span>
        <span style={{ color: "var(--accent-primary)" }}>{branch}</span>
      </div>
    </div>
  );
}
