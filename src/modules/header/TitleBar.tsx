import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/Icon";
import { Dot } from "@/components/Dot";
import { useTabs } from "@/modules/tabs/useTabs";

interface TitleBarProps {
  onToggleSidebar: () => void;
}

/**
 * macOS overlay header bar — modeled on terax-ai's Header.
 *
 * Layout: [80px traffic-light gutter] · [sidebar toggle] · [divider] ·
 * [tabs] · [draggable spacer] · [settings button]
 *
 * Drag is wired imperatively via Tauri's `startDragging()` because the
 * declarative `data-tauri-drag-region` path is unreliable on this Tauri
 * 2.11 + macOS combination. `data-tauri-drag-region` is set anyway as a
 * belt-and-suspenders fallback. Interactive elements get explicit no-drag.
 */
export function TitleBar({ onToggleSidebar }: TitleBarProps) {
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
    void getCurrentWindow().startDragging();
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
        title="Toggle explorer (⌘B)"
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
