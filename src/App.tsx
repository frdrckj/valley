import { useEffect, useState, type ReactNode } from "react";
import { TitleBar } from "@/modules/header/TitleBar";
import { TabStrip } from "@/modules/tabs/TabStrip";
import { useTabs } from "@/modules/tabs/useTabs";
import { FileTree } from "@/modules/explorer/FileTree";
import { StatusBar } from "@/modules/statusbar/StatusBar";
import { TerminalStack } from "@/modules/terminal/TerminalStack";
import { AiPanel } from "@/modules/ai/AiPanel";
import { Omnibar } from "@/modules/ai/Omnibar";
import { Settings } from "@/modules/settings/Settings";
import {
  SCREENS,
  readScreen,
  writeQuery,
  type ScreenId,
} from "@/lib/screen";
import { useLayout, type Side } from "@/lib/layout";
import { hydrateSettings, useSettings, patchSettings } from "@/lib/settings";
import { setLive } from "@/lib/workspace";

const WORKSPACE_ROOT = "/Users/frederickjerusha/Documents/works/terminal/valley";

export default function App() {
  const [screen, setScreen] = useState<ScreenId>(readScreen());
  const [tabsHover, setTabsHover] = useState(false);
  const { sidebar: sidebarSide, ai: aiSide } = useLayout();
  const settings = useSettings();

  useEffect(() => {
    void hydrateSettings();
  }, []);

  useEffect(() => {
    const { tabs, open } = useTabs.getState();
    if (tabs.length === 0) open({ kind: "terminal", label: "zsh" });
  }, []);

  useEffect(() => {
    setLive({
      cwd: () => null,           // TODO: per-pane cwd
      terminalTail: () => "",    // TODO: per-pane tail
      valleyMd: () => null,      // J2 fills this in
    });
  }, []);

  useEffect(() => {
    // "auto" falls back to dark until media-query handling is added (TODO).
    const resolved = settings.theme === "auto" ? "dark" : settings.theme;
    document.documentElement.dataset.theme = resolved;
  }, [settings.theme]);

  function pickScreen(s: ScreenId) {
    setScreen(s);
    writeQuery("screen", s);
  }
  function pickTheme(t: "dark" | "light") {
    void patchSettings({ theme: t });
  }

  const tabsHidden = screen === "zen" && !tabsHover;
  const showSidebar =
    ["full", "splits", "ai", "ghost", "error"].includes(screen);
  const showAiPanel = ["full", "ai", "ghost"].includes(screen);
  const aiPending = screen === "ai";
  const showOmnibar = screen === "omnibar";
  const isSettings = screen === "settings";

  const panes = composeBodyPanes({
    showSidebar,
    showAiPanel,
    sidebarSide,
    aiSide,
    aiPending,
    workspaceRoot: WORKSPACE_ROOT,
  });

  return (
    <div className="vy-app">
      <TitleBar />

      {!isSettings && (
        <div
          onMouseEnter={() => setTabsHover(true)}
          onMouseLeave={() => setTabsHover(false)}
        >
          <TabStrip hidden={tabsHidden} />
        </div>
      )}

      <div className="vy-body">
        {isSettings ? (
          <Settings />
        ) : (
          <>
            {panes.left}
            <div className="vy-main" style={{ position: "relative" }}>
              <TerminalStack />
            </div>
            {panes.right}
          </>
        )}
      </div>

      <StatusBar aiState={screen === "ai" ? "thinking" : "ready"} />

      {showOmnibar && <Omnibar />}

      <ScreenSwitcher
        screen={screen}
        theme={settings.theme === "auto" ? "dark" : settings.theme}
        onScreen={pickScreen}
        onTheme={pickTheme}
      />
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
  workspaceRoot: string;
}): { left: ReactNode[]; right: ReactNode[] } {
  const left: ReactNode[] = [];
  const right: ReactNode[] = [];

  if (opts.showSidebar) {
    const tree = (
      <FileTree key="explorer" root={opts.workspaceRoot} side={opts.sidebarSide} />
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
