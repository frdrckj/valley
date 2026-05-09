import { useEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutId } from "./shortcuts";

export type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler>>;

export type UseGlobalShortcutsOptions = {
  isDisabled?: (id: ShortcutId, e: KeyboardEvent) => boolean;
};

/**
 * Capture-phase global keyboard shortcut dispatcher. Mirrors terax-ai's
 * pattern: each shortcut owns its own `match()` predicate, and we run
 * `preventDefault` + `stopImmediatePropagation` only when a handler is
 * registered for the matched id. Capture-phase ensures we win against
 * inner inputs like xterm, CodeMirror, and the AI composer textarea.
 */
export function useGlobalShortcuts(
  handlers: ShortcutHandlers,
  options?: UseGlobalShortcutsOptions,
) {
  const latest = useRef({ handlers, options });
  latest.current = { handlers, options };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { handlers, options } = latest.current;
      for (const s of SHORTCUTS) {
        if (!s.match(e)) continue;
        if (options?.isDisabled?.(s.id, e)) return;
        const h = handlers[s.id];
        if (!h) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        h(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}
