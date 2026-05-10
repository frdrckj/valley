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
import { hydrateSettings, useSettings, patchSettings } from "@/lib/settings";
import { applyChromeTheme, getTheme, resolveTheme } from "@/modules/theme/themes";
import { setLive } from "@/lib/workspace";
import { native } from "@/lib/native";
import { useGlobalShortcuts } from "@/modules/shortcuts/useGlobalShortcuts";
import { ShortcutsDialog } from "@/modules/shortcuts/ShortcutsDialog";
import {
  closePane,
  findActive,
  focusNeighbor,
  splitPane,
  type Direction,
} from "@/modules/terminal/lib/splits";
import { SearchBar } from "@/modules/terminal/SearchBar";
import {
  getBlockTrackerFor,
  getTerminalFor,
} from "@/modules/terminal/lib/useTerminalSession";

const WORKSPACE_ROOT = "/Users/frederickjerusha/Documents/works/terminal/valley";

/**
 * Split the active pane of the active tab. The new pane gets a fresh PTY
 * session id so the next mount kicks off a new shell.
 */
function splitActivePane(dir: "v" | "h") {
  const s = useTabs.getState();
  if (!s.activeId) return;
  const tab = s.tabs.find((t) => t.id === s.activeId);
  if (!tab || tab.kind !== "terminal") return;
  const active = findActive(tab.panes);
  if (!active) return;
  const newSessionId = `pty-${tab.id}-${Date.now().toString(36)}`;
  s.setPanes(tab.id, splitPane(tab.panes, active.sessionId, dir, newSessionId));
}

/** Move pane focus in the active tab via the splits.ts helper. */
function focusNeighborInActiveTab(direction: Direction) {
  const s = useTabs.getState();
  if (!s.activeId) return;
  const tab = s.tabs.find((t) => t.id === s.activeId);
  if (!tab || tab.kind !== "terminal") return;
  s.setPanes(tab.id, focusNeighbor(tab.panes, direction));
}

/** Jump the active terminal pane to the previous / next prompt block.
 *  No-op if the active tab isn't a terminal or no blocks have been
 *  recorded yet (fresh shell that hasn't emitted OSC 133 A). */
function navigatePrompt(dir: "prev" | "next") {
  const s = useTabs.getState();
  if (!s.activeId) return;
  const tab = s.tabs.find((t) => t.id === s.activeId);
  if (!tab || tab.kind !== "terminal") return;
  const active = findActive(tab.panes);
  if (!active) return;
  const tracker = getBlockTrackerFor(active.sessionId);
  const term = getTerminalFor(active.sessionId);
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
  const { sidebar: sidebarSide, ai: aiSide } = useLayout();
  const settings = useSettings();
  const [valleyMd, setValleyMd] = useState<string | null>(null);
  const omnibar = useOmnibar();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const devUI = isDevModeUI();
  // Track the active terminal's cwd via the useTabs store. The OSC 7
  // handler in useTerminalSession writes to `tab.cwd` whenever the shell
  // emits a cwd update; we read it here so the file explorer's root
  // follows the user's `cd` commands.
  const activeCwd = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.cwd ?? null,
  );
  const explorerRoot = activeCwd ?? WORKSPACE_ROOT;

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
    "shortcuts.open": () => setShortcutsOpen((v) => !v),
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
      // Closes the focused pane. If the tab had splits and only one pane
      // remains, this collapses to that pane. The tab itself is closed
      // only when the last pane is gone.
      const s = useTabs.getState();
      if (!s.activeId) return;
      const tab = s.tabs.find((t) => t.id === s.activeId);
      if (!tab) return;
      // File tab with unsaved edits: confirm before closing.
      if (tab.kind === "file" && tab.dirty) {
        if (!window.confirm(`Discard unsaved changes to ${tab.label}?`)) return;
      }
      const active = findActive(tab.panes);
      if (!active) {
        s.close(tab.id);
        return;
      }
      const next = closePane(tab.panes, active.sessionId);
      if (next === null) s.close(tab.id);
      else s.setPanes(tab.id, next);
    },
    "split.vertical": () => splitActivePane("v"),
    "split.horizontal": () => splitActivePane("h"),
    "pane.focus.left": () => focusNeighborInActiveTab("left"),
    "pane.focus.right": () => focusNeighborInActiveTab("right"),
    "pane.focus.up": () => focusNeighborInActiveTab("up"),
    "pane.focus.down": () => focusNeighborInActiveTab("down"),
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
    "ai.toggle": () => setAiPanelOpen((v) => !v),
    "ai.askSelection": () => {
      // For now, treat this as "open the AI omnibar" — closest current behavior
      // until we wire selection capture from xterm.
      setAiPanelOpen((v) => !v);
    },
    "sidebar.toggle": () => setExplorerOpen((v) => !v),
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
    explorerRoot,
  });

  return (
    <div className="vy-app">
      <TitleBar
        onToggleSidebar={() => setExplorerOpen((v) => !v)}
        onOpenShortcuts={() => setShortcutsOpen((v) => !v)}
      />

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

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

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
  explorerRoot: string;
}): { left: ReactNode[]; right: ReactNode[] } {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  if (opts.showSidebar) {
    const tree = (
      <FileTree key="explorer" root={opts.explorerRoot} side={opts.sidebarSide} />
    );
    if (opts.sidebarSide === "left") left.push(tree);
    else right.push(tree);
  }
  if (opts.showAiPanel) {
    const ai = (
      <AiPanel key="ai" side={opts.aiSide} withToolCall={opts.aiPending} />
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
