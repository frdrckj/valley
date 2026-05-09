interface TitleBarProps {
  cwd?: string;
  branch?: string;
}

export function TitleBar({ cwd = "~/code/valley", branch = "main" }: TitleBarProps) {
  return (
    <div className="vy-titlebar">
      <div className="vy-traffic">
        <span className="t r" />
        <span className="t y" />
        <span className="t g" />
      </div>
      <div style={{ flex: 1 }} />
      <div className="vy-cwd">
        <span style={{ color: "var(--text-muted)" }}>{cwd}</span>
        <span style={{ color: "var(--border-strong)", margin: "0 8px" }}>·</span>
        <span style={{ color: "var(--accent-primary)" }}>{branch}</span>
      </div>
    </div>
  );
}
