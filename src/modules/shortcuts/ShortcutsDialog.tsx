import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Kbd } from "@/components/Kbd";
import { SHORTCUTS, SHORTCUT_GROUPS } from "./shortcuts";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  // Esc closes from anywhere (capture so we beat xterm/CodeMirror).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="vy-shortcuts-overlay" onClick={onClose}>
      <div className="vy-shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="vy-shortcuts-head">
          <div>
            <div className="vy-shortcuts-title">Keyboard shortcuts</div>
            <div className="vy-shortcuts-sub">
              Quick reference for valley controls.
            </div>
          </div>
          <button
            className="vy-shortcuts-close"
            onClick={onClose}
            type="button"
            title="Close (esc)"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="vy-shortcuts-body">
          {SHORTCUT_GROUPS.map((group) => {
            const items = SHORTCUTS.filter((s) => s.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="vy-shortcuts-section">
                <h3 className="vy-shortcuts-section-h">{group.toUpperCase()}</h3>
                <ul className="vy-shortcuts-list">
                  {items.map((s) => (
                    <li key={s.id} className="vy-shortcuts-row">
                      <span className="vy-shortcuts-label">{s.label}</span>
                      <span className="vy-shortcuts-keys">
                        {s.keys.map((k, i) => (
                          <Kbd key={i}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
