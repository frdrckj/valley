import { useEffect, useRef } from "react";
import { SHORTCUTS, type ShortcutId } from "./shortcuts";

export type ShortcutHandler = (e: KeyboardEvent) => void;
export type ShortcutHandlers = Partial<Record<ShortcutId, ShortcutHandler>>;

export type UseGlobalShortcutsOptions = {
  isDisabled?: (id: ShortcutId, e: KeyboardEvent) => boolean;
};

// Module-level mirror of the latest registered handlers. Powers
// `dispatchShortcutById` so things like the omnibar's command palette can
// invoke a shortcut programmatically without a synthetic KeyboardEvent.
const globalHandlers: { current: ShortcutHandlers } = { current: {} };

/** Programmatically invoke a registered shortcut handler by id. No-op if
 *  the id isn't currently bound. */
export function dispatchShortcutById(id: ShortcutId): void {
  const h = globalHandlers.current[id];
  if (!h) return;
  // Synthesize a minimal event so handlers that read `e.key` etc. don't
  // crash. None of valley's current handlers actually inspect the event.
  h(new KeyboardEvent("keydown"));
}

/**
 * Capture-phase global keyboard shortcut dispatcher. Each shortcut
 * owns its own `match()` predicate, and we run `preventDefault` +
 * `stopImmediatePropagation` only when a handler is registered for
 * the matched id. Capture-phase ensures we win against inner inputs
 * like xterm, CodeMirror, and the AI composer textarea.
 */
export function useGlobalShortcuts(
  handlers: ShortcutHandlers,
  options?: UseGlobalShortcutsOptions,
) {
  const latest = useRef({ handlers, options });
  latest.current = { handlers, options };
  // Mirror so `dispatchShortcutById` can find the same handlers.
  globalHandlers.current = handlers;

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
