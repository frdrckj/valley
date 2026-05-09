import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/Icon";
import { Dot } from "@/components/Dot";
import { useTabs } from "@/modules/tabs/useTabs";

interface TitleBarProps {
  onToggleSidebar: () => void;
  onOpenShortcuts: () => void;
}

/**
 * macOS overlay header bar — modeled on terax-ai's Header. Drag is wired
 * through both terax's declarative path (`data-tauri-drag-region`) AND
 * an imperative `getCurrentWindow().startDragging()` fallback so at
 * least one path lands on every Tauri / macOS combination.
 *
 * Layout: [80 px traffic-light gutter] [sidebar toggle] [divider] [tabs]
 * [draggable spacer] [shortcuts] [settings]
 */
export function TitleBar({ onToggleSidebar, onOpenShortcuts }: TitleBarProps) {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const { activate, close, open } = useTabs.getState();

  function isInteractive(target: EventTarget | null) {
    return Boolean(
      (target as HTMLElement | null)?.closest(
        "button, input, a, select, textarea, [data-no-drag]",
      ),
    );
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0 || isInteractive(e.target)) return;
    // Diagnostic: log every drag attempt so we can tell from the devtools
    // console whether the handler is firing AND whether startDragging
    // resolves. Open the webview's right-click → Inspect → Console to see.
    console.log(
      "[valley] header mousedown — calling startDragging()",
      (e.target as HTMLElement)?.tagName,
    );
    void getCurrentWindow()
      .startDragging()
      .then(() => console.log("[valley] startDragging resolved"))
      .catch((err) => console.error("[valley] startDragging failed:", err));
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (isInteractive(e.target)) return;
    void getCurrentWindow().toggleMaximize();
  }

  return (
    <div
      className="vy-header"
      data-tauri-drag-region
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <button
        className="vy-header-btn"
        onClick={onToggleSidebar}
        title="Toggle file explorer (⌘B)"
        data-no-drag
        type="button"
      >
        <Icon name="panel-left" size={16} />
      </button>

      <span className="vy-header-divider" />

      <div className="vy-header-tabs" data-tauri-drag-region>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`vy-header-tab${t.id === activeId ? " is-active" : ""}`}
            onClick={() => activate(t.id)}
            data-no-drag
          >
            <Dot tone="muted" glow={false} />
            <span>{t.label}</span>
            <span
              className="vy-header-tab-x"
              onClick={(e) => {
                e.stopPropagation();
                close(t.id);
              }}
            >
              <Icon name="x" size={10} />
            </span>
          </div>
        ))}
        <button
          className="vy-header-tab-add"
          onClick={() => open({ kind: "terminal", label: "zsh" })}
          title="New tab (⌘T)"
          data-no-drag
          type="button"
        >
          <Icon name="plus" size={12} />
        </button>
      </div>

      <div className="vy-header-spacer" data-tauri-drag-region />

      <button
        className="vy-header-btn"
        onClick={onOpenShortcuts}
        title="Keyboard shortcuts (⌘K)"
        data-no-drag
        type="button"
      >
        <Icon name="keyboard" size={16} />
      </button>
      <button
        className="vy-header-btn"
        onClick={() => void invoke("open_settings_window")}
        title="Settings (⌘,)"
        data-no-drag
        type="button"
      >
        <Icon name="settings" size={15} />
      </button>
    </div>
  );
}
