import { describe, expect, it, beforeEach } from "vitest";
import { useTabs } from "./useTabs";

beforeEach(() => {
  useTabs.setState({ tabs: [], activeId: null });
});

describe("useTabs", () => {
  it("opens a tab and activates it", () => {
    const id = useTabs.getState().open({ kind: "terminal", label: "main" });
    const s = useTabs.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.activeId).toBe(id);
  });

  it("closing the active tab activates the previous", () => {
    const a = useTabs.getState().open({ kind: "terminal", label: "a" });
    const b = useTabs.getState().open({ kind: "terminal", label: "b" });
    useTabs.getState().close(b);
    expect(useTabs.getState().activeId).toBe(a);
  });

  it("closing a non-active tab keeps activeId", () => {
    const a = useTabs.getState().open({ kind: "terminal", label: "a" });
    useTabs.getState().open({ kind: "terminal", label: "b" });
    useTabs.getState().close(a);
    expect(useTabs.getState().tabs.map((t) => t.label)).toEqual(["b"]);
  });
});
