import { create } from "zustand";

/**
 * One-shot channel for handing terminal context to the AI composer.
 *
 * `setPending` stashes a snippet (selection or last command's output);
 * the AI panel subscribes and consumes it on the next render, prepending
 * a fenced code block to the composer text. Consume clears the slot so
 * a stale snippet doesn't get re-attached on a later panel re-open.
 */
interface AiContextState {
  pending: string | null;
  setPending: (text: string | null) => void;
  consume: () => string | null;
}

export const useAiContext = create<AiContextState>((set, get) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  consume: () => {
    const text = get().pending;
    if (text !== null) set({ pending: null });
    return text;
  },
}));
