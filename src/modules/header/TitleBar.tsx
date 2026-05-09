interface TitleBarProps {
  cwd?: string;
  branch?: string;
}

/**
 * macOS overlay title bar. The OS renders the real traffic lights —
 * we leave 76 px of left padding so they don't overlap our content.
 * The whole bar is `data-tauri-drag-region` so the user can drag the
 * window from any non-interactive part of it.
 */
export function TitleBar({ cwd = "~/code/valley", branch = "main" }: TitleBarProps) {
  return (
    <div className="vy-titlebar" data-tauri-drag-region>
      <div style={{ flex: 1 }} />
      <div className="vy-cwd" data-tauri-drag-region>
        <span style={{ color: "var(--text-muted)" }} data-tauri-drag-region>
          {cwd}
        </span>
        <span
          style={{ color: "var(--border-strong)", margin: "0 8px" }}
          data-tauri-drag-region
        >
          ·
        </span>
        <span
          style={{ color: "var(--accent-primary)" }}
          data-tauri-drag-region
        >
          {branch}
        </span>
      </div>
    </div>
  );
}
