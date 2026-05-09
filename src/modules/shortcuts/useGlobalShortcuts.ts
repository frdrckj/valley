import { useEffect } from "react";
import { SHORTCUTS, matchCombo } from "./shortcuts";

export function useGlobalShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      for (const s of SHORTCUTS) {
        if (matchCombo(e, s.combo) && handlers[s.id]) {
          e.preventDefault();
          handlers[s.id]();
          return;
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handlers]);
}
