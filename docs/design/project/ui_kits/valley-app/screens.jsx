/* global React, ReactDOM, Icon, Kbd, Btn, Dot, TitleBar, TabStrip, FileTree, StatusBar */
const { useState, useEffect, useRef } = React;

/* ============================================================
   Terminal pane — prompt, output, ghost suggestion, error banner
   ============================================================ */
function Terminal({ ghost, error, focused = true, vsplit, hsplit, lines = DEFAULT_LINES, prompt = "git che" }) {
  const inner = (
    <div className="vy-term-pane" style={{ borderLeftColor: focused ? "var(--accent-primary)" : "transparent" }}>
      {!focused && <div className="vy-term-dim" />}
      <div className="vy-term-scroll">
        {lines.map((l, i) => <TermLine key={i} {...l} />)}
        {error && <ErrorBanner cmd={error} />}
        <div className="vy-term-prompt">
          <span className="ps1"><span style={{ color: "var(--accent-aqua)" }}>~/valley</span> <span style={{ color: "var(--accent-primary)" }}>main</span> <span style={{ color: "var(--accent-success)" }}>›</span></span>
          <span className="cmd">{prompt}</span>
          {ghost && <span className="ghost">{ghost}<Kbd>tab</Kbd></span>}
          <span className="cur" />
        </div>
      </div>
    </div>
  );
  if (vsplit) {
    return (
      <div className="vy-split v">
        {inner}
        <div className="vy-gutter v" />
        <Terminal focused={false} prompt="pnpm test" lines={DEFAULT_LINES_TEST} />
      </div>
    );
  }
  if (hsplit) {
    return (
      <div className="vy-split h">
        {inner}
        <div className="vy-gutter h" />
        <Terminal focused={false} prompt="git status" lines={DEFAULT_LINES_GIT} />
      </div>
    );
  }
  return inner;
}

function TermLine({ kind, text, sub }) {
  if (kind === "in") return (
    <div className="line in">
      <span className="ps1"><span style={{ color: "var(--accent-aqua)" }}>~/valley</span> <span style={{ color: "var(--accent-primary)" }}>main</span> <span style={{ color: "var(--accent-success)" }}>›</span></span>
      <span>{text}</span>
    </div>
  );
  if (kind === "out") return <div className="line out">{text}</div>;
  if (kind === "ok")  return <div className="line"><span style={{ color: "var(--accent-success)" }}>✓</span> <span>{text}</span></div>;
  if (kind === "err") return <div className="line"><span style={{ color: "var(--accent-danger)" }}>✗</span> <span>{text}</span></div>;
  if (kind === "dim") return <div className="line dim">{text}</div>;
  return <div className="line">{text}</div>;
}

const DEFAULT_LINES = [
  { kind: "in",  text: "pnpm dev" },
  { kind: "ok",  text: "ready in 1.2s" },
  { kind: "dim", text: "  ➜  Local:   http://localhost:5173/" },
  { kind: "dim", text: "  ➜  Network: use --host to expose" },
  { kind: "in",  text: "git status" },
  { kind: "out", text: "On branch main · up to date" },
  { kind: "dim", text: "Changes not staged for commit:" },
  { kind: "out", text: "  modified:  src/main.tsx" },
  { kind: "out", text: "  modified:  tailwind.css" },
];
const DEFAULT_LINES_TEST = [
  { kind: "in",  text: "pnpm test --watch" },
  { kind: "dim", text: " RUN  v1.6.0 ~/valley" },
  { kind: "ok",  text: "src/parser.test.ts (18)" },
  { kind: "ok",  text: "src/tokens.test.ts (24)" },
  { kind: "out", text: "Test Files  2 passed (2)" },
  { kind: "out", text: "     Tests  42 passed (42)" },
];
const DEFAULT_LINES_GIT = [
  { kind: "in",  text: "git log --oneline -5" },
  { kind: "out", text: "3a9f2b1 feat: ghost suggestions" },
  { kind: "out", text: "a04bf12 chore: pin geist mono" },
  { kind: "out", text: "8ce4710 fix: tab focus ring" },
];

/* ============================================================
   Error banner — "↩ ask valley?"
   ============================================================ */
function ErrorBanner({ cmd = "gti push" }) {
  return (
    <div className="vy-errbanner">
      <span className="x" style={{ color: "var(--accent-danger)" }}>✗</span>
      <span style={{ color: "var(--text-strong)" }}>command not found:</span>
      <span style={{ color: "var(--accent-danger)" }}>{cmd}</span>
      <span className="askvalley">
        <span>↩ ask valley?</span>
        <Kbd>↩</Kbd>
      </span>
    </div>
  );
}

/* ============================================================
   AI Panel — pinnable, resizable
   ============================================================ */
function AiPanel({ width = 360, withToolCall, onPin, pinned = true }) {
  return (
    <div className="vy-aipanel" style={{ width }}>
      <div className="vy-aipanel-head">
        <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
        <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>valley</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, color: "var(--text-muted)" }}>
          <Icon name="plus" size={12} />
          <Icon name="pin" size={12} style={{ color: pinned ? "var(--accent-primary)" : "var(--text-muted)" }} onClick={onPin} />
          <Icon name="x" size={12} />
        </span>
      </div>

      <div className="vy-aipanel-body">
        <div className="msg user">
          <div className="who">you · 2:38 pm</div>
          <div className="bubble">refactor the parser to support inline ghost suggestions</div>
        </div>

        <div className="msg ai">
          <div className="who"><Icon name="sparkle" size={11} style={{ color: "var(--accent-ai)" }} /> valley · thinking</div>
          <div className="bubble">
            I'll add a tokenizer pass for ghost completion. Reading the current parser:
          </div>
        </div>

        <ToolCallCard kind="file_read" name="src/lib/parser.ts" status="auto" />

        {withToolCall ? (
          <ToolCallCard kind="write_file" name="src/lib/parser.ts" status="pending" diff />
        ) : (
          <ToolCallCard kind="write_file" name="src/lib/parser.ts" status="approved" />
        )}

        <div className="msg ai">
          <div className="who"><Icon name="sparkle" size={11} style={{ color: "var(--accent-ai)" }} /> valley</div>
          <div className="bubble">Done. Tokenizer adds <span className="mono">GhostToken</span> with one-line lookahead — 14 lines added, 3 removed.</div>
        </div>
      </div>

      <div className="vy-aipanel-composer">
        <Icon name="clip" size={13} style={{ color: "var(--text-muted)" }} />
        <input className="input" placeholder="ask valley · ⌘K to focus" style={{ flex: 1, background: "transparent", border: "none" }} />
        <Icon name="mic" size={13} style={{ color: "var(--text-muted)" }} />
        <Icon name="send" size={13} style={{ color: "var(--accent-primary)" }} />
      </div>
    </div>
  );
}

function ToolCallCard({ kind, name, status, diff }) {
  const meta = {
    file_read:    { tone: "info",    icon: "file",     verb: "read" },
    write_file:   { tone: "primary", icon: "file",     verb: "write" },
    run_command:  { tone: "warning", icon: "terminal", verb: "run" },
  }[kind];
  const statusBadge = {
    auto:     { bg: "rgba(184,187,38,0.15)", fg: "var(--accent-success)", label: "auto · ✓" },
    approved: { bg: "rgba(184,187,38,0.15)", fg: "var(--accent-success)", label: "approved · ✓" },
    pending:  { bg: "rgba(250,189,47,0.15)", fg: "var(--accent-primary)", label: "pending · approval" },
  }[status];

  return (
    <div className="toolcall" style={status === "pending" ? { borderColor: "var(--accent-primary)" } : null}>
      <div className="head">
        <Icon name={meta.icon} size={11} style={{ color: "var(--accent-" + meta.tone + ")" }} />
        <span className="name">{kind}</span>
        <span style={{ color: "var(--text-muted)" }}>{name}</span>
        <span className="badge" style={{ background: statusBadge.bg, color: statusBadge.fg }}>{statusBadge.label}</span>
      </div>
      {diff && (
        <div className="body" style={{ fontSize: 11, lineHeight: 1.6 }}>
          <span style={{ color: "var(--accent-success)" }}>+ 14</span> &nbsp;
          <span style={{ color: "var(--accent-danger)" }}>− 3</span><br />
          <span style={{ color: "var(--text-muted)" }}>add tokenizer for inline ghost suggestions</span>
        </div>
      )}
      {status === "pending" && (
        <div className="actions">
          <Btn variant="primary" style={{ height: 24, fontSize: 11 }}>Approve <Kbd dark>↩</Kbd></Btn>
          <Btn variant="secondary" style={{ height: 24, fontSize: 11 }}>Diff</Btn>
          <Btn variant="ghost" style={{ height: 24, fontSize: 11, marginLeft: "auto" }}>Reject <Kbd>esc</Kbd></Btn>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Omnibar — Cmd+K floating input
   ============================================================ */
function Omnibar() {
  return (
    <div className="vy-omni-overlay">
      <div className="vy-omni">
        <div className="vy-omni-head">
          <Icon name="sparkle" size={14} style={{ color: "var(--accent-ai)" }} />
          <input className="input" autoFocus
                 defaultValue="explain the difference between"
                 style={{ flex: 1, background: "transparent", border: "none", fontSize: 16, height: 32 }} />
          <Kbd>esc</Kbd>
        </div>
        <div className="vy-omni-list">
          <OmniRow icon="terminal" tone="info" title='Run "explain"' sub="ask valley to explain the current selection" hot="↩" active />
          <OmniRow icon="search" title='Search project for "explain"' sub="34 matches in 12 files" hot="⌘P" />
          <OmniRow icon="file" title="src/lib/parser.ts" sub="src/lib · modified" />
          <OmniRow icon="folder" title="src-tauri/" sub="recent" />
          <OmniSep />
          <OmniRow icon="settings" title="Open settings" hot="⌘," dim />
          <OmniRow icon="vibrancy" title="Toggle vibrancy" sub="window blur · macOS only" dim />
        </div>
        <div className="vy-omni-foot">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↩</Kbd> select</span>
          <span><Kbd>⌘</Kbd><Kbd>↩</Kbd> ask valley</span>
          <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>haiku · 0 tokens</span>
        </div>
      </div>
    </div>
  );
}
function OmniRow({ icon, tone = "muted", title, sub, hot, active, dim }) {
  return (
    <div className={"omni-row " + (active ? "is-active" : "") + (dim ? " is-dim" : "")}>
      <Icon name={icon} size={13} style={{ color: tone === "info" ? "var(--accent-info)" : "var(--text-muted)" }} />
      <div className="col">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </div>
      {hot && <Kbd>{hot}</Kbd>}
    </div>
  );
}
function OmniSep() { return <div className="omni-sep" />; }

/* ============================================================
   Settings
   ============================================================ */
function Settings() {
  const [active, setActive] = useState("Appearance");
  const cats = ["General", "Appearance", "Terminal", "Keymap", "AI · valley", "Privacy", "Updates", "About"];
  const [vibrancy, setVibrancy] = useState(true);
  const [ligatures, setLigatures] = useState(false);
  const [autoApprove, setAutoApprove] = useState(true);
  const [theme, setTheme] = useState("dark");

  return (
    <div className="vy-settings">
      <div className="cats">
        <div className="cats-head">SETTINGS</div>
        {cats.map(c => (
          <div key={c} className={"cats-row " + (active === c ? "is-active" : "")} onClick={() => setActive(c)}>
            {c}
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <h2>{active}</h2>
          <div className="hint">⌘, to reopen · changes save instantly</div>
        </div>

        <Section label="THEME">
          <Row title="Color theme" sub="Gruvbox is the only canonical palette.">
            <div className="seg">
              <span className={"seg-i " + (theme === "dark" ? "on" : "")} onClick={() => setTheme("dark")}>dark</span>
              <span className={"seg-i " + (theme === "light" ? "on" : "")} onClick={() => setTheme("light")}>light hard</span>
              <span className={"seg-i " + (theme === "auto" ? "on" : "")} onClick={() => setTheme("auto")}>follow system</span>
            </div>
          </Row>
          <Row title="Window vibrancy" sub="macOS background blur · adds warmth, costs a little perf">
            <Switch on={vibrancy} onChange={() => setVibrancy(v => !v)} />
          </Row>
          <Row title="Font ligatures" sub="Geist Mono → ‒› ≠ ⇒ etc.">
            <Switch on={ligatures} onChange={() => setLigatures(v => !v)} />
          </Row>
          <Row title="Cursor" sub="Block · classic terminal">
            <select className="select" defaultValue="block">
              <option value="block">block</option>
              <option value="underscore">underscore</option>
              <option value="bar">bar</option>
            </select>
          </Row>
        </Section>

        <Section label="AI · valley">
          <Row title="Auto-approve read tools" sub="file_read, list_dir, grep — no approval prompt">
            <Switch on={autoApprove} onChange={() => setAutoApprove(v => !v)} />
          </Row>
          <Row title="Inline ghost suggestions" sub="dimmed continuation as you type · ⇥ to accept">
            <Switch on={true} />
          </Row>
          <Row title="Ask valley shortcut">
            <span className="kbd-pair"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          </Row>
          <Row title="Model" sub="haiku is the default fast model">
            <select className="select" defaultValue="haiku-4.5">
              <option>haiku-4.5</option>
              <option>sonnet-4.5</option>
              <option>opus-4.1</option>
            </select>
          </Row>
        </Section>

        <Section label="DATA">
          <Row title="Telemetry" sub="anonymous error reports only">
            <Switch on={false} />
          </Row>
          <Row title="Reset all settings" sub="this cannot be undone">
            <Btn variant="destructive">Reset…</Btn>
          </Row>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="set-section">
      <div className="set-section-h">{label}</div>
      <div className="set-section-b">{children}</div>
    </div>
  );
}
function Row({ title, sub, children }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <div className="set-row-ctrl">{children}</div>
    </div>
  );
}
function Switch({ on, onChange }) {
  return (
    <div className={"switch " + (on ? "is-on" : "")} onClick={onChange}>
      <div className="knob" />
    </div>
  );
}

Object.assign(window, { Terminal, ErrorBanner, AiPanel, ToolCallCard, Omnibar, Settings });
