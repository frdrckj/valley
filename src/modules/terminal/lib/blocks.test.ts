import { describe, it, expect } from "vitest";
import {
  createBlockTracker,
  type BlockEvent,
  type MarkerSource,
} from "./blocks";

interface FakeMarker {
  line: number;
  isDisposed: boolean;
  onDispose: (cb: () => void) => { dispose: () => void };
  dispose: () => void;
}

function makeMarker(line: number): FakeMarker {
  let cb: (() => void) | null = null;
  return {
    line,
    isDisposed: false,
    onDispose(c) {
      cb = c;
      return { dispose: () => { cb = null; } };
    },
    dispose() {
      this.isDisposed = true;
      cb?.();
    },
  };
}

interface FakeSource extends MarkerSource {
  markers: FakeMarker[];
}

function makeSource(): FakeSource {
  const markers: FakeMarker[] = [];
  let nextLine = 0;
  return {
    markers,
    registerMarker() {
      const m = makeMarker(nextLine++);
      markers.push(m);
      // FakeMarker structurally satisfies xterm's IMarker for our usage.
      return m as unknown as ReturnType<MarkerSource["registerMarker"]>;
    },
  };
}

function captureEvents(tracker: ReturnType<typeof createBlockTracker>) {
  const events: BlockEvent[] = [];
  tracker.subscribe((e) => events.push(e));
  return events;
}

describe("BlockTracker", () => {
  it("emits 'added' on prompt-A", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    const events = captureEvents(t);
    t.onPromptStart();
    expect(t.blocks()).toHaveLength(1);
    expect(t.blocks()[0]?.exitCode).toBe(null);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("added");
  });

  it("emits 'updated' with exit 0", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    const events = captureEvents(t);
    t.onPromptStart();
    t.onCommandStart();
    t.onCommandExit(0);
    const b = t.blocks()[0]!;
    expect(b.exitCode).toBe(0);
    expect(b.executingAt).toBeTypeOf("number");
    expect(events.map((e) => e.type)).toEqual(["added", "updated"]);
  });

  it("emits 'updated' with non-zero exit", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    t.onPromptStart();
    t.onCommandExit(1);
    expect(t.blocks()[0]?.exitCode).toBe(1);
  });

  it("force-closes the previous block on a new prompt-A without D", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    t.onPromptStart();
    t.onPromptStart();
    expect(t.blocks()).toHaveLength(2);
    expect(t.blocks()[0]?.exitCode).toBe(null);
    expect(t.blocks()[0]?.endedAt).toBeTypeOf("number");
  });

  it("ignores D when there are no blocks", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    expect(() => t.onCommandExit(0)).not.toThrow();
    expect(t.blocks()).toHaveLength(0);
  });

  it("ignores duplicate D on the same block", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    t.onPromptStart();
    t.onCommandExit(0);
    t.onCommandExit(7);
    expect(t.blocks()[0]?.exitCode).toBe(0);
  });

  it("prevBlockLine returns the largest line strictly above viewport", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    t.onPromptStart();
    t.onPromptStart();
    t.onPromptStart();
    expect(t.prevBlockLine(2)).toBe(1);
    expect(t.prevBlockLine(1)).toBe(0);
    expect(t.prevBlockLine(0)).toBe(null);
  });

  it("nextBlockLine returns the smallest line strictly below viewport", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    t.onPromptStart();
    t.onPromptStart();
    t.onPromptStart();
    expect(t.nextBlockLine(0)).toBe(1);
    expect(t.nextBlockLine(1)).toBe(2);
    expect(t.nextBlockLine(2)).toBe(null);
  });

  it("emits 'removed' when a marker disposes", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    const events = captureEvents(t);
    t.onPromptStart();
    expect(t.blocks()).toHaveLength(1);
    src.markers[0]!.dispose();
    expect(t.blocks()).toHaveLength(0);
    expect(events.some((e) => e.type === "removed")).toBe(true);
  });

  it("dispose clears blocks and stops emitting", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    const events: BlockEvent[] = [];
    t.subscribe((e) => events.push(e));
    t.onPromptStart();
    t.dispose();
    expect(t.blocks()).toHaveLength(0);
    // Post-dispose calls are no-ops.
    t.onPromptStart();
    t.onCommandExit(0);
    // Only the pre-dispose 'added' event should be in the buffer.
    expect(events.map((e) => e.type)).toEqual(["added"]);
  });

  it("unsubscribe stops the listener", () => {
    const src = makeSource();
    const t = createBlockTracker(src);
    const events: BlockEvent[] = [];
    const off = t.subscribe((e) => events.push(e));
    t.onPromptStart();
    off();
    t.onPromptStart();
    expect(events).toHaveLength(1);
  });
});
