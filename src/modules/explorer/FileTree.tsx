import { Icon, type IconName } from "@/components/Icon";
import type { Side } from "@/lib/layout";

interface RowProps {
  depth: number;
  twisty?: string;
  ico: IconName;
  name: string;
  status?: { tone: "info" | "success" | "warning" | "danger"; glyph: string };
  active?: boolean;
  dim?: boolean;
}

function Row({ depth, twisty, ico, name, status, active, dim }: RowProps) {
  return (
    <div
      className={`tree-row${active ? " is-active" : ""}`}
      style={{ paddingLeft: 10 + depth * 14 }}
    >
      <span className="twisty">{twisty ?? ""}</span>
      <Icon name={ico} size={12} />
      <span
        style={{
          color: active
            ? "var(--accent-primary)"
            : dim
              ? "var(--text-muted)"
              : "inherit",
        }}
      >
        {name}
      </span>
      {status && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: `var(--accent-${status.tone === "danger" ? "danger" : status.tone})`,
          }}
        >
          {status.glyph}
        </span>
      )}
    </div>
  );
}

interface FileTreeProps {
  collapsed?: boolean;
  side?: Side;
}

export function FileTree({ collapsed, side = "left" }: FileTreeProps) {
  if (collapsed) return null;
  return (
    <div className="vy-tree" data-side={side}>
      <div className="vy-tree-head">
        <span>EXPLORER</span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            gap: 6,
            color: "var(--text-muted)",
          }}
        >
          <Icon name="plus" size={11} />
          <Icon name="refresh" size={11} />
        </span>
      </div>
      <Row depth={0} twisty="▾" ico="folder-open" name="valley" />
      <Row depth={1} twisty="▾" ico="folder-open" name="src" />
      <Row depth={2} ico="file" name="App.tsx" />
      <Row
        depth={2}
        ico="file"
        name="main.tsx"
        status={{ tone: "info", glyph: "M" }}
      />
      <Row depth={2} twisty="▸" ico="folder" name="components" />
      <Row depth={1} twisty="▾" ico="folder-open" name="src-tauri" />
      <Row depth={2} ico="file" name="main.rs" active />
      <Row depth={2} ico="file" name="Cargo.toml" />
      <Row
        depth={2}
        ico="file"
        name="build.rs"
        dim
        status={{ tone: "info", glyph: "M" }}
      />
      <Row
        depth={1}
        ico="file"
        name="tailwind.css"
        status={{ tone: "success", glyph: "A" }}
      />
      <Row depth={1} ico="file" name="package.json" />
      <Row depth={1} ico="file" name="README.md" />
    </div>
  );
}
