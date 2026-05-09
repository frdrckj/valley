import { describe, it, expect } from "vitest";
import {
  type Pane,
  splitPane,
  closePane,
  focusNeighbor,
  findActive,
  newLeaf,
} from "./splits";

describe("splits.ts", () => {
  it("a single leaf is its own active pane", () => {
    const tree: Pane = newLeaf("s1");
    expect(findActive(tree)?.sessionId).toBe("s1");
  });

  it("splitting a leaf vertically yields two leaves", () => {
    const before: Pane = newLeaf("s1");
    const after = splitPane(before, "s1", "v", "s2");
    expect(after.kind).toBe("split");
    if (after.kind === "split") {
      expect(after.dir).toBe("v");
      expect(findActive(after)?.sessionId).toBe("s2");
    }
  });

  it("closing the only pane leaves null", () => {
    const tree: Pane = newLeaf("s1");
    expect(closePane(tree, "s1")).toBeNull();
  });

  it("closing one side of a split collapses to the other leaf", () => {
    let tree: Pane = newLeaf("s1");
    tree = splitPane(tree, "s1", "v", "s2");
    const after = closePane(tree, "s1");
    expect(after?.kind).toBe("leaf");
    if (after?.kind === "leaf") expect(after.sessionId).toBe("s2");
  });

  it("focusNeighbor right moves to the next leaf", () => {
    let tree: Pane = newLeaf("s1");
    tree = splitPane(tree, "s1", "v", "s2");
    // s2 is active after split; nudge left and we land on s1
    const nudged = focusNeighbor(tree, "left");
    expect(findActive(nudged)?.sessionId).toBe("s1");
  });
});
