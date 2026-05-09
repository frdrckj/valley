import { Kbd } from "@/components/Kbd";
import { ErrorBanner } from "./ErrorBanner";

/**
 * Mock terminal renderer for the design-system pass.
 *
 * Phase 1 implementation replaces the inner `vy-term-scroll` with a real
 * xterm.js WebGL canvas wired to a `pty_open` Tauri channel. The chrome
 * (border-left focus indicator, prompt strip, ghost suggestion, error
 * banner, splits) stays the same — only the scroll-back rendering swaps.
 */

export type TermLineKind = "in" | "out" | "ok" | "err" | "dim";
export interface TermLine {
  kind: TermLineKind;
  text: string;
}

interface TerminalProps {
  ghost?: string | null;
  error?: string | null;
  focused?: boolean;
  vsplit?: boolean;
  hsplit?: boolean;
  prompt?: string;
  lines?: TermLine[];
}

function PromptPrefix() {
  return (
    <span className="ps1">
      <span style={{ color: "var(--accent-aqua)" }}>~/valley</span>{" "}
      <span style={{ color: "var(--accent-primary)" }}>main</span>{" "}
      <span style={{ color: "var(--accent-success)" }}>›</span>
    </span>
  );
}

function TermLineRow({ kind, text }: TermLine) {
  if (kind === "in") {
    return (
      <div className="line in">
        <PromptPrefix />
        <span>{text}</span>
      </div>
    );
  }
  if (kind === "ok") {
    return (
      <div className="line">
        <span style={{ color: "var(--accent-success)" }}>✓</span> <span>{text}</span>
      </div>
    );
  }
  if (kind === "err") {
    return (
      <div className="line">
        <span style={{ color: "var(--accent-danger)" }}>✗</span> <span>{text}</span>
      </div>
    );
  }
  if (kind === "dim") return <div className="line dim">{text}</div>;
  return <div className="line out">{text}</div>;
}

export const DEFAULT_LINES: TermLine[] = [
  { kind: "in", text: "pnpm dev" },
  { kind: "ok", text: "ready in 1.2s" },
  { kind: "dim", text: "  ➜  Local:   http://localhost:5173/" },
  { kind: "dim", text: "  ➜  Network: use --host to expose" },
  { kind: "in", text: "git status" },
  { kind: "out", text: "On branch main · up to date" },
  { kind: "dim", text: "Changes not staged for commit:" },
  { kind: "out", text: "  modified:  src/main.tsx" },
  { kind: "out", text: "  modified:  tailwind.css" },
];

const DEFAULT_LINES_TEST: TermLine[] = [
  { kind: "in", text: "pnpm test --watch" },
  { kind: "dim", text: " RUN  v1.6.0 ~/valley" },
  { kind: "ok", text: "src/parser.test.ts (18)" },
  { kind: "ok", text: "src/tokens.test.ts (24)" },
  { kind: "out", text: "Test Files  2 passed (2)" },
  { kind: "out", text: "     Tests  42 passed (42)" },
];

const DEFAULT_LINES_GIT: TermLine[] = [
  { kind: "in", text: "git log --oneline -5" },
  { kind: "out", text: "3a9f2b1 feat: ghost suggestions" },
  { kind: "out", text: "a04bf12 chore: pin geist mono" },
  { kind: "out", text: "8ce4710 fix: tab focus ring" },
];

function TerminalPane({
  ghost,
  error,
  focused = true,
  prompt = "git status",
  lines = DEFAULT_LINES,
}: Omit<TerminalProps, "vsplit" | "hsplit">) {
  return (
    <div
      className="vy-term-pane"
      style={{ borderLeftColor: focused ? "var(--accent-primary)" : "transparent" }}
    >
      {!focused && <div className="vy-term-dim" />}
      <div className="vy-term-scroll">
        {lines.map((l, i) => (
          <TermLineRow key={i} {...l} />
        ))}
        {error && <ErrorBanner cmd={error} />}
        <div className="vy-term-prompt">
          <PromptPrefix />
          <span className="cmd">{prompt}</span>
          {ghost && (
            <span className="ghost">
              {ghost}
              <Kbd>tab</Kbd>
            </span>
          )}
          <span className="cur" />
        </div>
      </div>
    </div>
  );
}

export function Terminal(props: TerminalProps) {
  const { vsplit, hsplit, ...rest } = props;

  if (vsplit) {
    return (
      <div className="vy-split v">
        <TerminalPane {...rest} />
        <div className="vy-gutter v" />
        <TerminalPane focused={false} prompt="pnpm test" lines={DEFAULT_LINES_TEST} />
      </div>
    );
  }
  if (hsplit) {
    return (
      <div className="vy-split h">
        <TerminalPane {...rest} />
        <div className="vy-gutter h" />
        <TerminalPane focused={false} prompt="git status" lines={DEFAULT_LINES_GIT} />
      </div>
    );
  }
  return <TerminalPane {...rest} />;
}
