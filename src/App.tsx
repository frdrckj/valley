import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "@/modules/header/TitleBar";
import { useTabs } from "@/modules/tabs/useTabs";
import { hydrateTabs, startTabsPersistence } from "@/modules/tabs/persistence";
import { FileTree } from "@/modules/explorer/FileTree";
import { StatusBar } from "@/modules/statusbar/StatusBar";
import { TerminalStack } from "@/modules/terminal/TerminalStack";
import { AiPanel } from "@/modules/ai/AiPanel";
import { Omnibar as AiOmnibar } from "@/modules/ai/Omnibar";
import { Omnibar } from "@/modules/omnibar/Omnibar";
import { useOmnibar } from "@/modules/omnibar/lib/useOmnibar";
import { hydrateRecent, startRecentTracking } from "@/modules/omnibar/lib/recent";
import { Settings } from "@/modules/settings/Settings";
import {
  SCREENS,
  readScreen,
  writeQuery,
  isDevModeUI,
  type ScreenId,
} from "@/lib/screen";
import { useLayout, type Side } from "@/lib/layout";
import { hydrateSettings, useSettings, patchSettings, getSettingsSnapshot } from "@/lib/settings";
import { applyChromeTheme, getTheme, resolveTheme } from "@/modules/theme/themes";
import { setLive } from "@/lib/workspace";
import { native } from "@/lib/native";
import { useGlobalShortcuts } from "@/modules/shortcuts/useGlobalShortcuts";
import { Welcome } from "@/modules/welcome/Welcome";
import { DecodePanel } from "@/modules/decode/DecodePanel";
import { useDecodePanel } from "@/modules/decode/useDecodePanel";
import { EngagementDialog } from "@/modules/engagement/EngagementDialog";
import { useEngagementDialog } from "@/modules/engagement/useEngagementDialog";
import { hydrateEngagements, useEngagement } from "@/modules/engagement/useEngagement";
import { SnippetPalette } from "@/modules/snippets/SnippetPalette";
import { useSnippetPalette } from "@/modules/snippets/lib/useSnippetPalette";
import { SearchBar } from "@/modules/terminal/SearchBar";
import {
  getBlockTrackerFor,
  getTerminalFor,
} from "@/modules/terminal/lib/useTerminalSession";
import { useAiContext } from "@/modules/ai/store/contextStore";

const WORKSPACE_ROOT = "/Users/frederickjerusha/Documents/works/terminal/valley";

/** Read the active terminal tab's session id, or null if the active
 *  tab isn't a terminal. Replaces the previous PaneTree walk now that
 *  valley delegates pane splitting to tmux. */
function activeTerminalSessionId(): string | null {
  const s = useTabs.getState();
  if (!s.activeId) return null;
  const tab = s.tabs.find((t) => t.id === s.activeId);
  if (!tab || tab.kind !== "terminal") return null;
  return tab.sessionId ?? null;
}

/** Capture text to feed into the AI composer when the user hits ⌘L.
 *  Priority: explicit terminal selection → most-recent completed
 *  block's output → null (caller just opens the panel). */
function captureActiveTerminalContext(): string | null {
  const sessionId = activeTerminalSessionId();
  if (!sessionId) return null;
  const term = getTerminalFor(sessionId);
  if (!term) return null;

  const sel = term.getSelection();
  if (sel && sel.trim()) return sel;

  const tracker = getBlockTrackerFor(sessionId);
  if (!tracker) return null;
  const blocks = tracker.blocks();
  let targetIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.exitCode !== null && blocks[i]?.exitCode !== undefined) {
      targetIdx = i;
      break;
    }
  }
  const target = targetIdx >= 0 ? blocks[targetIdx] : null;
  if (!target) return null;

  const next = blocks[targetIdx + 1];
  const startLine = target.startMarker.line;
  const endLine = next
    ? next.startMarker.line
    : term.buffer.active.baseY + term.buffer.active.cursorY + 1;
  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let y = startLine; y < endLine; y++) {
    const line = buf.getLine(y);
    if (line) lines.push(line.translateToString(true));
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Copy the most-recent completed command's output (the block from its
 *  prompt-A marker through the next prompt-A) to the clipboard. No-op
 *  if no command has finished yet. */
function copyCurrentBlock() {
  const sessionId = activeTerminalSessionId();
  if (!sessionId) return;
  const tracker = getBlockTrackerFor(sessionId);
  const term = getTerminalFor(sessionId);
  if (!tracker || !term) return;

  const blocks = tracker.blocks();
  // Walk back to the most-recent block that has an exit code.
  let targetIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.exitCode !== null && blocks[i]?.exitCode !== undefined) {
      targetIdx = i;
      break;
    }
  }
  const target = targetIdx >= 0 ? blocks[targetIdx] : null;
  if (!target) return;

  const next = blocks[targetIdx + 1];
  const startLine = target.startMarker.line;
  const endLine = next
    ? next.startMarker.line
    : term.buffer.active.baseY + term.buffer.active.cursorY + 1;

  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let y = startLine; y < endLine; y++) {
    const line = buf.getLine(y);
    if (line) lines.push(line.translateToString(true));
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  void navigator.clipboard.writeText(lines.join("\n"));
}

const ZOOM_MIN = 10;
const ZOOM_MAX = 24;
const ZOOM_DEFAULT = 17;

/** Bump (or reset) the terminal font size. The live-swap effect in
 *  useTerminalSession picks up settings.terminalFontSize and rescales
 *  every open xterm in place — no remount, no flicker. */
function zoomTerminal(delta: number | "reset") {
  const current =
    getSettingsSnapshot().terminalFontSize ?? ZOOM_DEFAULT;
  const next =
    delta === "reset"
      ? ZOOM_DEFAULT
      : Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + delta));
  if (next === current) return;
  void patchSettings({ terminalFontSize: next });
}

/** Jump the active terminal pane to the previous / next prompt block.
 *  No-op if the active tab isn't a terminal or no blocks have been
 *  recorded yet (fresh shell that hasn't emitted OSC 133 A). */
function navigatePrompt(dir: "prev" | "next") {
  const sessionId = activeTerminalSessionId();
  if (!sessionId) return;
  const tracker = getBlockTrackerFor(sessionId);
  const term = getTerminalFor(sessionId);
  if (!tracker || !term) return;
  const viewportTop = term.buffer.active.viewportY;
  const target =
    dir === "prev"
      ? tracker.prevBlockLine(viewportTop)
      : tracker.nextBlockLine(viewportTop);
  if (target === null) return;
  // Marker.line is in the absolute buffer (includes scrollback). xterm's
  // scrollToLine takes a viewport-relative offset, so subtract baseY.
  const baseY = term.buffer.active.baseY;
  term.scrollToLine(target - baseY);
}

export default function App() {
  const [screen, setScreen] = useState<ScreenId>(readScreen());
  const { sidebar: sidebarSide, ai: aiSide, aiWidth } = useLayout();
  const settings = useSettings();
  const [valleyMd, setValleyMd] = useState<string | null>(null);
  const omnibar = useOmnibar();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const devUI = isDevModeUI();
  // Track the active terminal's cwd via the useTabs store. The OSC 7
  // handler in useTerminalSession writes to `tab.cwd` whenever the shell
  // emits a cwd update; we read it here so the file explorer's root
  // follows the user's `cd` commands.
  const activeCwd = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.cwd ?? null,
  );
  const activeCwdHost = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.cwdHost ?? "",
  );
  // The active engagement, when set, parks the explorer at its
  // workspace folder regardless of where the focused terminal happens
  // to be `cd`'d. Decoupling explorer ←→ terminal cwd lets the operator
  // roam (`cd /tmp`, `cd /var/log`) without losing sight of their
  // notes/loot directory. Falls back to the terminal cwd when there's
  // no active engagement (preserves the v0.3.x default for one-off use).
  const activeEngagement = useEngagement((s) => s.active());
  const engRootDir = activeEngagement?.rootDir ?? "";
  const engHost = activeEngagement?.host ?? "";
  const explorerRoot = engRootDir || activeCwd || WORKSPACE_ROOT;
  const explorerHost = engHost || activeCwdHost;

  useEffect(() => {
    void hydrateSettings();
  }, []);

  useEffect(() => {
    const path = `${WORKSPACE_ROOT}/VALLEY.md`;
    native.fs.readText(path).then(setValleyMd).catch(() => setValleyMd(null));
  }, []);

  useEffect(() => {
    let unsubTabs: (() => void) | null = null;
    let unsubRecent: (() => void) | null = null;
    void (async () => {
      const restored = await hydrateTabs();
      if (!restored) {
        useTabs.getState().open({ kind: "terminal", label: "zsh" });
      }
      // Subscribe AFTER hydrate so we don't immediately overwrite the
      // restored state with a half-loaded snapshot.
      unsubTabs = startTabsPersistence();
      // Hydrate recent files then start tracking new file tabs.
      await hydrateRecent();
      unsubRecent = startRecentTracking();
      // Hydrate engagement workspaces.
      await hydrateEngagements();
    })();
    return () => {
      unsubTabs?.();
      unsubRecent?.();
    };
  }, []);

  useEffect(() => {
    setLive({
      cwd: () => null,           // TODO: per-pane cwd
      terminalTail: () => "",    // TODO: per-pane tail
      valleyMd: () => valleyMd,
    });
  }, [valleyMd]);

  useEffect(() => {
    applyChromeTheme(getTheme(resolveTheme(settings.theme)));
  }, [settings.theme]);

  useGlobalShortcuts({
    "settings.open": () => void invoke("open_settings_window"),
    "tab.new": () => useTabs.getState().open({ kind: "terminal", label: "zsh" }),
    "omnibar.open": () => omnibar.toggle(),
    "tab.newPreview": () => {
      useTabs.getState().open({
        kind: "preview",
        label: "preview",
        url: "http://localhost:3000",
      });
    },
    "tab.newEditor": () => {
      console.log("[valley] tab.newEditor not implemented (Phase 3)");
    },
    "tab.close": () => {
      const s = useTabs.getState();
      if (!s.activeId) return;
      const tab = s.tabs.find((t) => t.id === s.activeId);
      if (!tab) return;
      // File tab with unsaved edits: confirm before closing.
      if (tab.kind === "file" && tab.dirty) {
        if (!window.confirm(`Discard unsaved changes to ${tab.label}?`)) return;
      }
      s.close(tab.id);
    },
    "tab.next": () => {
      const s = useTabs.getState();
      if (s.tabs.length === 0 || s.activeId === null) return;
      const i = s.tabs.findIndex((t) => t.id === s.activeId);
      const next = s.tabs[(i + 1) % s.tabs.length];
      if (next) s.activate(next.id);
    },
    "tab.prev": () => {
      const s = useTabs.getState();
      if (s.tabs.length === 0 || s.activeId === null) return;
      const i = s.tabs.findIndex((t) => t.id === s.activeId);
      const prev = s.tabs[(i - 1 + s.tabs.length) % s.tabs.length];
      if (prev) s.activate(prev.id);
    },
    "tab.selectByIndex": (e) => {
      const idx = Number.parseInt(e.key, 10) - 1;
      const s = useTabs.getState();
      const target = s.tabs[idx];
      if (target) s.activate(target.id);
    },
    "search.focus": () => setSearchOpen((v) => !v),
    "prompt.prev": () => navigatePrompt("prev"),
    "prompt.next": () => navigatePrompt("next"),
    "block.copy": () => copyCurrentBlock(),
    "terminal.zoomIn": () => zoomTerminal(+1),
    "terminal.zoomOut": () => zoomTerminal(-1),
    "terminal.zoomReset": () => zoomTerminal("reset"),
    "engagement.switch": () => useEngagementDialog.getState().open("switch"),
    "ai.toggle": () => setAiPanelOpen((v) => !v),
    "ai.askSelection": () => {
      // Capture before opening so the panel can consume on first render.
      const ctx = captureActiveTerminalContext();
      if (ctx) useAiContext.getState().setPending(ctx);
      setAiPanelOpen(true);
    },
    "sidebar.toggle": () => setExplorerOpen((v) => !v),
    "decode.open": () => useDecodePanel.getState().toggle(),
    "snippets.open": () => useSnippetPalette.getState().toggle(),
  });

  function pickScreen(s: ScreenId) {
    setScreen(s);
    writeQuery("screen", s);
  }
  function pickTheme(t: "dark" | "light") {
    void patchSettings({
      theme: t === "light" ? "gruvbox-light-hard" : "gruvbox-material-dark",
    });
  }

  // Explorer + AI panel are both hidden by default — minimalist by design.
  // ⌘B toggles explorer, ⌘I toggles AI panel.  The dev-only screen URL flags
  // (?screen=full / ?screen=ai etc.) still force them visible for the design
  // switcher, which itself only renders when ?dev=1.
  const showSidebar =
    explorerOpen || ["full", "splits", "ai", "ghost", "error"].includes(screen);
  const showAiPanel = aiPanelOpen || ["full", "ai", "ghost"].includes(screen);
  const aiPending = screen === "ai";
  const showAiOmnibar = screen === "omnibar";
  const isSettings = screen === "settings";

  const panes = composeBodyPanes({
    showSidebar,
    showAiPanel,
    sidebarSide,
    aiSide,
    aiPending,
    aiWidth,
    explorerRoot,
    explorerHost,
  });

  return (
    <div className="vy-app">
      <TitleBar onToggleSidebar={() => setExplorerOpen((v) => !v)} />

      <div className="vy-body">
        {isSettings ? (
          <Settings />
        ) : (
          <>
            {panes.left}
            <div className="vy-main" style={{ position: "relative" }}>
              <TerminalStack />
              {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
            </div>
            {panes.right}
          </>
        )}
      </div>

      <StatusBar aiState={screen === "ai" ? "thinking" : "ready"} />

      {showAiOmnibar && <AiOmnibar />}

      <Omnibar />

      <Welcome />

      <DecodePanel />

      <EngagementDialog />

      <SnippetPalette />

      {devUI && (
        <ScreenSwitcher
          screen={screen}
          theme={
            resolveTheme(settings.theme) === "gruvbox-light-hard"
              ? "light"
              : "dark"
          }
          onScreen={pickScreen}
          onTheme={pickTheme}
        />
      )}
    </div>
  );
}

/**
 * Place the file explorer and AI panel on their configured sides.
 *
 * When both panes share a side: file tree sits outermost, AI panel sits
 * closest to main. Settings can override each pane independently.
 */
function composeBodyPanes(opts: {
  showSidebar: boolean;
  showAiPanel: boolean;
  sidebarSide: Side;
  aiSide: Side;
  aiPending: boolean;
  aiWidth: number;
  explorerRoot: string;
  explorerHost: string;
}): { left: ReactNode[]; right: ReactNode[] } {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  if (opts.showSidebar) {
    const tree = (
      <FileTree
        key="explorer"
        root={opts.explorerRoot}
        host={opts.explorerHost}
        side={opts.sidebarSide}
      />
    );
    if (opts.sidebarSide === "left") left.push(tree);
    else right.push(tree);
  }
  if (opts.showAiPanel) {
    const ai = (
      <AiPanel
        key="ai"
        side={opts.aiSide}
        width={opts.aiWidth}
        withToolCall={opts.aiPending}
      />
    );
    // AI panel hugs the main area when sharing a side.
    if (opts.aiSide === "left") left.push(ai);
    else right.unshift(ai);
  }

  return { left, right };
}

interface ScreenSwitcherProps {
  screen: ScreenId;
  theme: "dark" | "light";
  onScreen: (s: ScreenId) => void;
  onTheme: (t: "dark" | "light") => void;
}

function ScreenSwitcher({ screen, theme, onScreen, onTheme }: ScreenSwitcherProps) {
  return (
    <div className="vy-screen-switcher">
      {SCREENS.map((s) => (
        <span
          key={s.id}
          className={`pill${screen === s.id ? " on" : ""}`}
          onClick={() => onScreen(s.id)}
        >
          {s.label}
        </span>
      ))}
      <span
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "var(--border-strong)",
          margin: "2px 4px",
        }}
      />
      <span
        className={`pill${theme === "dark" ? " on" : ""}`}
        onClick={() => onTheme("dark")}
      >
        dark
      </span>
      <span
        className={`pill${theme === "light" ? " on" : ""}`}
        onClick={() => onTheme("light")}
      >
        light
      </span>
    </div>
  );
}
