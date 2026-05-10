export type Pane =
  | { kind: "leaf"; sessionId: string; active: boolean }
  | { kind: "split"; dir: "v" | "h"; ratio: number; a: Pane; b: Pane };

export function newLeaf(sessionId: string, active = true): Pane {
  return { kind: "leaf", sessionId, active };
}

export function findActive(p: Pane): { sessionId: string } | null {
  if (p.kind === "leaf") return p.active ? { sessionId: p.sessionId } : null;
  return findActive(p.a) ?? findActive(p.b);
}

function setAllInactive(p: Pane): Pane {
  if (p.kind === "leaf") return { ...p, active: false };
  return { ...p, a: setAllInactive(p.a), b: setAllInactive(p.b) };
}

export function splitPane(
  tree: Pane,
  targetSessionId: string,
  dir: "v" | "h",
  newSessionId: string,
): Pane {
  if (tree.kind === "leaf") {
    if (tree.sessionId !== targetSessionId) return tree;
    return {
      kind: "split",
      dir,
      ratio: 0.5,
      a: { kind: "leaf", sessionId: tree.sessionId, active: false },
      b: { kind: "leaf", sessionId: newSessionId, active: true },
    };
  }
  return {
    ...tree,
    a: splitPane(tree.a, targetSessionId, dir, newSessionId),
    b: splitPane(tree.b, targetSessionId, dir, newSessionId),
  };
}

export function closePane(tree: Pane, sessionId: string): Pane | null {
  if (tree.kind === "leaf") {
    return tree.sessionId === sessionId ? null : tree;
  }
  const a = closePane(tree.a, sessionId);
  const b = closePane(tree.b, sessionId);
  if (a && b) return { ...tree, a, b };
  if (a) return ensureSomeActive(a);
  if (b) return ensureSomeActive(b);
  return null;
}

function ensureSomeActive(p: Pane): Pane {
  if (findActive(p)) return p;
  if (p.kind === "leaf") return { ...p, active: true };
  return { ...p, a: ensureSomeActive(p.a) };
}

export type Direction = "left" | "right" | "up" | "down";

/** Move focus to a neighbor pane in the given direction. */
export function focusNeighbor(tree: Pane, direction: Direction): Pane {
  const order = collectLeavesInOrder(tree);
  const activeIndex = order.findIndex((p) => p.active);
  if (activeIndex < 0) return tree;
  const delta = direction === "left" || direction === "up" ? -1 : 1;
  const next = order[Math.max(0, Math.min(order.length - 1, activeIndex + delta))];
  if (!next || next === order[activeIndex]) return tree;
  return setActiveSession(setAllInactive(tree), next.sessionId);
}

/** Set the named leaf as the active pane. Used by click-to-focus handlers. */
export function focusPane(tree: Pane, sessionId: string): Pane {
  return setActiveSession(setAllInactive(tree), sessionId);
}

/**
 * Update the ratio of the split node at `path`. Path is an array of
 * "a"/"b" picks from the root, so `[]` is the root split itself, and
 * `["a", "b"]` walks into the root's a-child and then that node's
 * b-child. No-op if the resolved node isn't a split.
 */
export function updateSplitRatio(
  tree: Pane,
  path: Array<"a" | "b">,
  ratio: number,
): Pane {
  const clamped = Math.max(0.05, Math.min(0.95, ratio));
  if (path.length === 0) {
    return tree.kind === "split" ? { ...tree, ratio: clamped } : tree;
  }
  if (tree.kind !== "split") return tree;
  const [head, ...rest] = path;
  if (head === "a") return { ...tree, a: updateSplitRatio(tree.a, rest, clamped) };
  return { ...tree, b: updateSplitRatio(tree.b, rest, clamped) };
}

function collectLeavesInOrder(p: Pane): Array<{ sessionId: string; active: boolean }> {
  if (p.kind === "leaf") return [{ sessionId: p.sessionId, active: p.active }];
  return [...collectLeavesInOrder(p.a), ...collectLeavesInOrder(p.b)];
}

function setActiveSession(p: Pane, sessionId: string): Pane {
  if (p.kind === "leaf") return { ...p, active: p.sessionId === sessionId };
  return {
    ...p,
    a: setActiveSession(p.a, sessionId),
    b: setActiveSession(p.b, sessionId),
  };
}
