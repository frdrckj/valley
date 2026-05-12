import type { Terminal as XTerm } from "@xterm/xterm";
import type { Block, BlockTracker } from "./blocks";

/** Pretty-print a duration in ms. <1s → "234ms", <60s → "2.3s",
 *  <60min → "1m32s", else "Xm". Used for block hover tooltips. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`;
}

/** Tooltip text for a completed block — exit code + elapsed time. */
function describeBlock(b: Block): string {
  const exit = b.exitCode === 0 ? "exit 0" : `exit ${b.exitCode}`;
  // Prefer C→D timing (actual command runtime); fall back to A→D
  // when preexec didn't fire (e.g. the user hit Enter on an empty
  // prompt, or for an interactive program that bypassed C).
  const start = b.executingAt ?? b.startedAt;
  const end = b.endedAt ?? Date.now();
  return `${exit} · ${formatDuration(end - start)}`;
}

/**
 * DOM-based block-mark renderer.
 *
 * The earlier xterm-decoration approach put marks at column 0 of the
 * terminal grid, which (a) partially obscured the prompt glyph and
 * (b) inherited xterm's default cell tinting in some configs. Marks
 * belong outside the terminal canvas — this module owns a sibling
 * `<div class="vy-block-gutter">` and absolute-positions one mark per
 * exited block by computing pixel offsets from `marker.line` and the
 * terminal's measured row height.
 */

interface GutterTheme {
  ok: string;
  fail: string;
}

export interface BlockGutter {
  setTheme(theme: GutterTheme): void;
  /** Recompute every mark's vertical rect. Call after layout changes
   *  the gutter's own size or the xterm's row metrics — fit(), font
   *  swap, visibility toggle, etc. */
  reposition(): void;
  dispose(): void;
}

export function attachBlockGutter(
  term: XTerm,
  tracker: BlockTracker,
  gutter: HTMLElement,
  initialTheme: GutterTheme,
): BlockGutter {
  let theme = initialTheme;
  const marks = new Map<string, HTMLDivElement>();

  // Row height in pixels. Priority order:
  //   1. xterm's `.xterm-rows` first child if present (DOM renderer
  //      writes a real `<div>` per row — its offsetHeight is exact).
  //   2. .xterm-viewport's clientHeight / term.rows — works in canvas
  //      and WebGL mode, but vulnerable to sub-pixel rounding when the
  //      viewport hasn't been re-measured after a font-size swap.
  //   3. Computed from fontSize × lineHeight — last-resort fallback for
  //      the brief window between mount and first fit().
  // Recomputed on every call (cheap) so we always reflect the current
  // metrics, not a stale snapshot from when the gutter was attached.
  function measureRowHeight(): number {
    const root = term.element;
    if (root) {
      const firstRow = root.querySelector(
        ".xterm-rows > div",
      ) as HTMLElement | null;
      if (firstRow && firstRow.offsetHeight > 0) {
        return firstRow.offsetHeight;
      }
      const viewport = root.querySelector(
        ".xterm-viewport",
      ) as HTMLElement | null;
      if (viewport && term.rows > 0) {
        const h = viewport.clientHeight / term.rows;
        if (h > 0) return h;
      }
    }
    const fontSize = term.options.fontSize ?? 17;
    const lineHeight = term.options.lineHeight ?? 1.05;
    return fontSize * lineHeight;
  }

  function colorFor(block: Block): string {
    return block.exitCode === 0 ? theme.ok : theme.fail;
  }

  /**
   * Compute the visible vertical rectangle for a block — from its
   * startMarker line to the next block's startMarker (or end-of-buffer
   * if this is the last completed block). The result is clipped to the
   * current viewport so marks scrolled out of view return null.
   */
  function computeRect(
    block: Block,
    nextStartLine: number | null,
  ): { top: number; height: number } | null {
    if (block.exitCode === null) return null;
    const rowHeight = measureRowHeight();
    if (rowHeight <= 0) return null;
    const viewportTop = term.buffer.active.viewportY;
    const startRow = block.startMarker.line - viewportTop;
    // End row = the next block's start, OR the bottom of the live buffer
    // (baseY + cursorY + 1) when this is the most-recent completed block
    // and the user hasn't started a new prompt yet.
    const endLine =
      nextStartLine !== null
        ? nextStartLine
        : term.buffer.active.baseY + term.buffer.active.cursorY + 1;
    const endRow = endLine - viewportTop;
    const visibleStart = Math.max(0, startRow);
    const visibleEnd = Math.min(term.rows, endRow);
    if (visibleEnd <= visibleStart) return null;
    return {
      top: visibleStart * rowHeight,
      height: (visibleEnd - visibleStart) * rowHeight,
    };
  }

  function ensureMark(
    block: Block,
    nextStartLine: number | null,
  ): HTMLDivElement | null {
    const rect = computeRect(block, nextStartLine);
    if (rect === null) {
      const existing = marks.get(block.id);
      if (existing) {
        existing.remove();
        marks.delete(block.id);
      }
      return null;
    }
    let el = marks.get(block.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "vy-block-gutter-mark";
      gutter.appendChild(el);
      marks.set(block.id, el);
    }
    el.style.top = `${rect.top}px`;
    el.style.height = `${rect.height}px`;
    el.style.background = colorFor(block);
    el.classList.toggle("is-fail", block.exitCode !== 0);
    el.classList.toggle("is-ok", block.exitCode === 0);
    // Native hover tooltip — `title` plays nicely with macOS overlay
    // delays and survives across xterm scroll without our own DOM work.
    el.title = describeBlock(block);
    return el;
  }

  function removeMark(blockId: string) {
    const el = marks.get(blockId);
    if (el) {
      el.remove();
      marks.delete(blockId);
    }
  }

  function repositionAll() {
    const all = tracker.blocks();
    for (let i = 0; i < all.length; i++) {
      const block = all[i]!;
      if (block.exitCode === null) {
        // No mark for unfinished blocks; cleanup any stale element.
        removeMark(block.id);
        continue;
      }
      // The next block's start marker is where this block's rail ends.
      // For the most-recent completed block, pass null → ensureMark
      // extends the rail to the cursor's current line.
      const next = all[i + 1] ?? null;
      ensureMark(block, next ? next.startMarker.line : null);
    }
  }

  // Wire tracker events. We can't paint a single block in isolation —
  // a new block changes the previous block's rail height (its end
  // moves up to the new prompt). So every event triggers a full
  // repositionAll. Cheap: O(visible blocks).
  const unsubTracker = tracker.subscribe((event) => {
    if (event.type === "removed") removeMark(event.blockId);
    repositionAll();
  });

  // Reposition whenever the user scrolls the terminal.
  const scrollDispose = term.onScroll(() => repositionAll());

  // Reposition on terminal resize too — row height can change with
  // font-size settings or DPI shifts.
  const ro = new ResizeObserver(() => repositionAll());
  if (term.element) ro.observe(term.element);

  // Initial paint for any blocks that already exited (rare but possible
  // during HMR / re-mounts).
  repositionAll();

  return {
    setTheme(next) {
      theme = next;
      repositionAll();
    },
    reposition: repositionAll,
    dispose() {
      unsubTracker();
      scrollDispose.dispose();
      ro.disconnect();
      for (const el of marks.values()) el.remove();
      marks.clear();
    },
  };
}
