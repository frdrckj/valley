import type { IMarker } from "@xterm/xterm";

/**
 * Per-command "block" tracking for an xterm session.
 *
 * Driven by OSC 133 markers — each prompt-A boundary opens a new block,
 * a prompt-D[;exit] closes it with a status, and the next prompt-A
 * forcibly closes any still-running block (covers `vim`/`less` cases
 * where no D ever fires).
 *
 * The tracker is purely a data manager: it owns the block list and emits
 * events. There is no visual gutter — the tracker exists to power the
 * prompt-prev/next shortcuts (⌘⇧↑/⌘⇧↓) and the copy-current-block
 * shortcut (⌘⇧C). A previous DOM-overlay renderer was removed in v0.3.4
 * because pixel-aligning marks against xterm's row metrics was fragile
 * across font swaps + DPR changes, and the marks were misleading inside
 * SSH sessions whose remote shells don't emit OSC 133.
 */

export type BlockStatus = "running" | "ok" | "fail";

export interface Block {
  id: string;
  startMarker: IMarker;
  exitCode: number | null;
  startedAt: number;
  executingAt: number | null;
  endedAt: number | null;
}

export type BlockEvent =
  /** A new block opened (prompt-A). No mark should be drawn yet — the
   *  exit status is what determines the visual treatment. */
  | { type: "added"; block: Block }
  /** A block's exit status changed (prompt-D). Renderers paint here. */
  | { type: "updated"; block: Block }
  /** A block was evicted (cap exceeded or marker scrolled off scrollback). */
  | { type: "removed"; blockId: string };

/** Maximum blocks kept in the tracker. Older blocks are evicted. */
const MAX_BLOCKS = 200;

let nextId = 1;
const newId = () => `b${nextId++}-${Date.now().toString(36)}`;

export interface BlockTracker {
  /** OSC 133 A — open a fresh block. */
  onPromptStart(): void;
  /** OSC 133 C — command starts executing. */
  onCommandStart(): void;
  /** OSC 133 D — last command finished; close block with exit code. */
  onCommandExit(code: number): void;
  /** Snapshot of current blocks (oldest → newest). */
  blocks(): Block[];
  /** Buffer line of the previous block above `viewportTop`, or null. */
  prevBlockLine(viewportTop: number): number | null;
  /** Buffer line of the next block below `viewportTop`, or null. */
  nextBlockLine(viewportTop: number): number | null;
  /** Subscribe to lifecycle events. Returns an unsubscribe fn. */
  subscribe(listener: (e: BlockEvent) => void): () => void;
  dispose(): void;
}

export interface MarkerSource {
  /** Register a marker at the current cursor row. */
  registerMarker(): IMarker | null;
}

export function createBlockTracker(source: MarkerSource): BlockTracker {
  const blocks: Block[] = [];
  const markerDisposeByBlockId = new Map<string, () => void>();
  const listeners = new Set<(e: BlockEvent) => void>();
  let disposed = false;

  function emit(e: BlockEvent) {
    for (const fn of listeners) fn(e);
  }

  function evictExcess() {
    while (blocks.length > MAX_BLOCKS) {
      const old = blocks.shift()!;
      markerDisposeByBlockId.get(old.id)?.();
      markerDisposeByBlockId.delete(old.id);
      emit({ type: "removed", blockId: old.id });
    }
  }

  function dropBlock(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    blocks.splice(idx, 1);
    markerDisposeByBlockId.get(id)?.();
    markerDisposeByBlockId.delete(id);
    emit({ type: "removed", blockId: id });
  }

  return {
    onPromptStart() {
      if (disposed) return;
      // Force-close any still-running block — covers the "ran vim, hit
      // :q" case where no D ever fired. We just stamp endedAt; exitCode
      // stays null so the block doesn't get a paint.
      const last = blocks[blocks.length - 1];
      if (last && last.exitCode === null) {
        last.endedAt = Date.now();
      }
      const marker = source.registerMarker();
      if (!marker) return;
      const block: Block = {
        id: newId(),
        startMarker: marker,
        exitCode: null,
        startedAt: Date.now(),
        executingAt: null,
        endedAt: null,
      };
      const handler = marker.onDispose(() => dropBlock(block.id));
      markerDisposeByBlockId.set(block.id, () => handler.dispose());
      blocks.push(block);
      evictExcess();
      emit({ type: "added", block });
    },

    onCommandStart() {
      if (disposed) return;
      const last = blocks[blocks.length - 1];
      if (last && last.executingAt === null) last.executingAt = Date.now();
    },

    onCommandExit(code) {
      if (disposed) return;
      const last = blocks[blocks.length - 1];
      if (!last || last.exitCode !== null) return;
      last.exitCode = code;
      last.endedAt = Date.now();
      emit({ type: "updated", block: last });
    },

    blocks() {
      return blocks.slice();
    },

    prevBlockLine(viewportTop) {
      let result: number | null = null;
      for (const b of blocks) {
        const line = b.startMarker.line;
        if (line < viewportTop && (result === null || line > result)) {
          result = line;
        }
      }
      return result;
    },

    nextBlockLine(viewportTop) {
      let result: number | null = null;
      for (const b of blocks) {
        const line = b.startMarker.line;
        if (line > viewportTop && (result === null || line < result)) {
          result = line;
        }
      }
      return result;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      disposed = true;
      for (const off of markerDisposeByBlockId.values()) off();
      markerDisposeByBlockId.clear();
      blocks.length = 0;
      listeners.clear();
    },
  };
}

import type { Terminal as XTerm } from "@xterm/xterm";

/** Default xterm-backed marker source. */
export function xtermMarkerSource(term: XTerm): MarkerSource {
  return {
    registerMarker() {
      return term.registerMarker(0) ?? null;
    },
  };
}
